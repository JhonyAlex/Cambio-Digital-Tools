
import { UserProfile, UserRole } from '../types';
import { FIREBASE_CONFIG, DB_PROVIDER } from './config';
import { DEFAULT_USER } from '../contexts/AuthContext';

interface IAuthService {
    login(email: string, pass: string): Promise<any>;
    register(email: string, pass: string, name: string): Promise<UserProfile>;
    logout(): Promise<void>;
    getUserProfile(uid: string): Promise<UserProfile | null>;
    getAllUsers(): Promise<UserProfile[]>;
    updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void>;
    deleteUser(uid: string): Promise<void>;
    updatePassword(newPass: string): Promise<void>;
    sendPasswordResetEmail(email: string): Promise<void>;
    createProfileIfMissing(user: any): Promise<UserProfile>;
    subscribeToAuth(callback: (user: any) => void): Promise<() => void> | (() => void);
}

// --- ADAPTER 1: LOCAL AUTH (MOCK) ---
class LocalAuthAdapter implements IAuthService {
    private KEY_USERS = 'chronos_local_users';
    private KEY_SESSION = 'chronos_local_session_uid';
    private listeners: ((user: any) => void)[] = [];

    private getUsers(): Record<string, any> { 
        const data = localStorage.getItem(this.KEY_USERS);
        return data ? JSON.parse(data) : {};
    }

    private saveUsers(users: Record<string, any>) {
        localStorage.setItem(this.KEY_USERS, JSON.stringify(users));
    }

    private notifyListeners(user: any) {
        this.listeners.forEach(listener => listener(user));
    }

    async login(email: string, pass: string) {
        // No simulated delay for production/clean state
        const cleanEmail = email.trim();
        const users = this.getUsers();
        const userEntry = Object.values(users).find((u: any) => u.profile.email.toLowerCase() === cleanEmail.toLowerCase());

        if (!userEntry) throw { code: 'auth/invalid-credential' };
        if (userEntry.password !== pass) throw { code: 'auth/invalid-credential' };

        localStorage.setItem(this.KEY_SESSION, userEntry.profile.uid);
        const sessionUser = { uid: userEntry.profile.uid, email: userEntry.profile.email };
        this.notifyListeners(sessionUser);
        return { user: sessionUser };
    }

    async register(email: string, pass: string, name: string): Promise<UserProfile> {
        // No simulated delay
        const cleanEmail = email.trim();
        const users = this.getUsers();
        const existing = Object.values(users).find((u: any) => u.profile.email.toLowerCase() === cleanEmail.toLowerCase());
        if (existing) throw { code: 'auth/email-already-in-use' };

        const uid = 'local_' + Date.now();
        const isFirstUser = Object.keys(users).length === 0;
        const role: UserRole = isFirstUser ? 'admin' : 'pending';

        const newProfile: UserProfile = {
            uid,
            email: cleanEmail,
            displayName: name,
            role,
            permissions: {
                canAccessChronos: isFirstUser,
                canAccessPayroll: isFirstUser,
                canAccessRevenue: isFirstUser,
                canAccessWallet: isFirstUser,
                canAccessBudgets: isFirstUser,
                canAccessPolisher: true, // Available to everyone
                canAccessMeetings: true // Available to everyone
            },
            createdAt: Date.now()
        };

        users[uid] = { profile: newProfile, password: pass };
        this.saveUsers(users);
        localStorage.setItem(this.KEY_SESSION, uid);
        this.notifyListeners({ uid });
        return newProfile;
    }

    async logout() {
        localStorage.removeItem(this.KEY_SESSION);
        this.notifyListeners(null);
    }

    async getUserProfile(uid: string): Promise<UserProfile | null> {
        const users = this.getUsers();
        return users[uid]?.profile || DEFAULT_USER;
    }

    async getAllUsers(): Promise<UserProfile[]> {
        const users = this.getUsers();
        const list = Object.values(users).map((u: any) => u.profile);
        return list.length > 0 ? list : [DEFAULT_USER];
    }

    async updateUserProfile(uid: string, data: Partial<UserProfile>) {
        const users = this.getUsers();
        if (users[uid]) {
            users[uid].profile = { ...users[uid].profile, ...data };
            this.saveUsers(users);
        }
    }

    async deleteUser(uid: string): Promise<void> {
        const users = this.getUsers();
        if (users[uid]) {
            delete users[uid];
            this.saveUsers(users);
        }
    }

    async updatePassword(newPass: string): Promise<void> {
        const uid = localStorage.getItem(this.KEY_SESSION);
        if (!uid) throw new Error("No active session");
        const users = this.getUsers();
        if (users[uid]) {
            users[uid].password = newPass;
            this.saveUsers(users);
        }
    }

    async sendPasswordResetEmail(email: string): Promise<void> {
        const users = this.getUsers();
        const exists = Object.values(users).some((u: any) => u.profile.email.toLowerCase() === email.toLowerCase());
        if (!exists) throw { code: 'auth/user-not-found' };
    }

    async createProfileIfMissing(user: any): Promise<UserProfile> {
        return this.register(user.email, 'password', user.displayName || 'Restored User');
    }

    subscribeToAuth(callback: (user: any) => void) {
        this.listeners.push(callback);
        const uid = localStorage.getItem(this.KEY_SESSION);
        const users = this.getUsers();
        if (uid && users[uid]) callback({ uid });
        else {
            if (uid) localStorage.removeItem(this.KEY_SESSION);
            callback(null);
        }
        return () => { this.listeners = this.listeners.filter(l => l !== callback); };
    }
}

// --- ADAPTER 2: FIREBASE AUTH ---
class FirebaseAuthAdapter implements IAuthService {
    private _firebasePromise: Promise<any> | null = null;

    // Singleton implementation to prevent multiple imports/initializations
    private loadFirebase() {
        if (!this._firebasePromise) {
            this._firebasePromise = (async () => {
                // @ts-ignore
                const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
                // @ts-ignore
                const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, deleteUser, sendPasswordResetEmail } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
                // @ts-ignore
                const { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                
                // Safe initialization check
                const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApp();
                
                return { 
                    auth: getAuth(app), 
                    db: getFirestore(app), 
                    signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, deleteAuthUser: deleteUser, sendPasswordResetEmail,
                    doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc
                };
            })();
        }
        return this._firebasePromise;
    }

    async login(email: string, pass: string) {
        const { auth, signInWithEmailAndPassword } = await this.loadFirebase();
        return await signInWithEmailAndPassword(auth, email.trim(), pass);
    }

    async register(email: string, pass: string, name: string) {
        const { auth, db, createUserWithEmailAndPassword, doc, setDoc, getDocs, collection } = await this.loadFirebase();
        const cleanEmail = email.trim();
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
        const user = userCredential.user;

        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        const isFirstUser = snapshot.empty;
        const role = isFirstUser ? 'admin' : 'pending';
        
        const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email || cleanEmail,
            displayName: name,
            role: role,
            permissions: {
                canAccessChronos: isFirstUser,
                canAccessPayroll: isFirstUser,
                canAccessRevenue: isFirstUser,
                canAccessWallet: isFirstUser,
                canAccessBudgets: isFirstUser,
                canAccessPolisher: true, // Available to everyone
                canAccessMeetings: true // Available to everyone
            },
            createdAt: Date.now()
        };

        await setDoc(doc(db, 'users', user.uid), newProfile);
        return newProfile;
    }

    async logout() {
        const { auth, signOut } = await this.loadFirebase();
        await signOut(auth);
    }

    async getUserProfile(uid: string): Promise<UserProfile | null> {
        try {
            const { db, doc, getDoc } = await this.loadFirebase();
            const docRef = doc(db, 'users', uid);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? (docSnap.data() as UserProfile) : DEFAULT_USER;
        } catch (error: any) {
            console.warn("Firestore Profile fetch fallback to DEFAULT_USER:", error);
            return DEFAULT_USER;
        }
    }

    // SELF-HEALING FUNCTION
    async createProfileIfMissing(firebaseUser: any): Promise<UserProfile> {
        const { db, doc, getDoc, setDoc, collection, getDocs } = await this.loadFirebase();
        
        try {
            const docRef = doc(db, 'users', firebaseUser.uid);
            
            // Double check existence to avoid overwrite race conditions
            try {
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    return docSnap.data() as UserProfile;
                }
            } catch (e: any) {
                if (e.code === 'permission-denied') throw new Error("FIREBASE_PERMISSION_DENIED");
            }

            const usersRef = collection(db, 'users');
            let isFirstUser = false;
            try {
                const snapshot = await getDocs(usersRef);
                isFirstUser = snapshot.empty;
            } catch (e) { console.warn("Admin check failed, safe default", e); }
            
            const newProfile: UserProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Restored User',
                role: isFirstUser ? 'admin' : 'pending',
                permissions: {
                    canAccessChronos: isFirstUser,
                    canAccessPayroll: isFirstUser,
                    canAccessRevenue: isFirstUser,
                    canAccessWallet: isFirstUser,
                    canAccessBudgets: isFirstUser,
                    canAccessPolisher: true,
                    canAccessMeetings: true
                },
                createdAt: Date.now()
            };

            await setDoc(docRef, newProfile);
            return newProfile;

        } catch (error: any) {
            console.error("Failed to self-heal:", error);
            if (error.code === 'permission-denied') throw new Error("FIREBASE_PERMISSION_DENIED");
            throw error;
        }
    }

    async getAllUsers(): Promise<UserProfile[]> {
        const { db, collection, getDocs } = await this.loadFirebase();
        const snapshot = await getDocs(collection(db, 'users'));
        return snapshot.docs.map((d: any) => d.data() as UserProfile);
    }

    async updateUserProfile(uid: string, data: Partial<UserProfile>) {
        const { db, doc, updateDoc } = await this.loadFirebase();
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, data);
    }

    async deleteUser(uid: string): Promise<void> {
        const { db, doc, deleteDoc } = await this.loadFirebase();
        await deleteDoc(doc(db, 'users', uid));
    }

    async updatePassword(newPass: string): Promise<void> {
        const { auth, updatePassword } = await this.loadFirebase();
        if (auth.currentUser) {
            await updatePassword(auth.currentUser, newPass);
        } else {
            throw new Error("No user logged in");
        }
    }

    async sendPasswordResetEmail(email: string): Promise<void> {
        const { auth, sendPasswordResetEmail } = await this.loadFirebase();
        await sendPasswordResetEmail(auth, email.trim());
    }

    subscribeToAuth(callback: (user: any) => void) {
        return this.loadFirebase().then(({ auth, onAuthStateChanged }) => {
            return onAuthStateChanged(auth, callback);
        });
    }
}

// --- FACTORY ---
let service: IAuthService;
if (DB_PROVIDER === 'firebase') {
    service = new FirebaseAuthAdapter();
} else {
    service = new LocalAuthAdapter();
}

export const authService = service;
