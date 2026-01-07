
import { PolisherRecord } from '../types';
import { DB_PROVIDER, FIREBASE_CONFIG, validateConnectivity } from './config';

export interface IPolisherRepository {
  getHistory(userId: string): Promise<PolisherRecord[]>;
  saveRecord(record: PolisherRecord): Promise<void>;
  deleteRecord(id: string): Promise<void>;
}

// --- ADAPTER 1: LOCAL STORAGE ---
class LocalStoragePolisherAdapter implements IPolisherRepository {
  private KEY = 'polisher_history';

  private getAll(): PolisherRecord[] {
      const data = localStorage.getItem(this.KEY);
      return data ? JSON.parse(data) : [];
  }

  async getHistory(userId: string): Promise<PolisherRecord[]> {
    await validateConnectivity();
    const all = this.getAll();
    return all.filter(r => r.userId === userId).sort((a,b) => b.createdAt - a.createdAt);
  }

  async saveRecord(record: PolisherRecord): Promise<void> {
    await validateConnectivity();
    const all = this.getAll();
    // Check if exists to update, else push
    const index = all.findIndex(r => r.id === record.id);
    if (index >= 0) all[index] = record;
    else all.push(record);
    localStorage.setItem(this.KEY, JSON.stringify(all));
  }

  async deleteRecord(id: string): Promise<void> {
    await validateConnectivity();
    const all = this.getAll();
    const filtered = all.filter(r => r.id !== id);
    localStorage.setItem(this.KEY, JSON.stringify(filtered));
  }
}

// --- ADAPTER 2: FIREBASE ---
class FirebasePolisherAdapter implements IPolisherRepository {
  private db: any;
  private isInitialized = false;

  constructor() { this.init(); }

  private async init() {
    if (this.isInitialized) return;
    try {
        // @ts-ignore
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
        // @ts-ignore
        const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const app = initializeApp(FIREBASE_CONFIG);
        this.db = getFirestore(app);
        this.isInitialized = true;
    } catch (e) { console.error("Firebase Polisher Init Error", e); }
  }

  private async getDb() {
    await validateConnectivity();
    if (!this.isInitialized) await this.init();
    if (!this.db) throw new Error("Firebase DB not initialized.");
    return this.db;
  }

  private async getFirestoreModules() {
      // @ts-ignore
      return await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
  }

  async getHistory(userId: string): Promise<PolisherRecord[]> {
    const db = await this.getDb();
    const { collection, getDocs, query, where, orderBy } = await this.getFirestoreModules();
    
    // Create query for user-specific history
    const q = query(
        collection(db, "polisher_history"), 
        where("userId", "==", userId)
        // Note: orderBy requires a composite index in Firestore if combined with where.
        // We sort in-memory to avoid index setup errors for the user.
    );
    
    const snapshot = await getDocs(q);
    const records = snapshot.docs.map((d: any) => d.data() as PolisherRecord);
    
    // Sort in memory by date descending
    return records.sort((a: PolisherRecord, b: PolisherRecord) => b.createdAt - a.createdAt);
  }

  async saveRecord(record: PolisherRecord): Promise<void> {
    const db = await this.getDb();
    const { doc, setDoc } = await this.getFirestoreModules();
    await setDoc(doc(db, "polisher_history", record.id), record, { merge: true });
  }

  async deleteRecord(id: string): Promise<void> {
    const db = await this.getDb();
    const { doc, deleteDoc } = await this.getFirestoreModules();
    await deleteDoc(doc(db, "polisher_history", id));
  }
}

let repository: IPolisherRepository;
if (DB_PROVIDER === 'firebase') {
  repository = new FirebasePolisherAdapter();
} else {
  repository = new LocalStoragePolisherAdapter();
}
export const polisherService = repository;
