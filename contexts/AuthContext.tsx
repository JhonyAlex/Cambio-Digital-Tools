
import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
    user: UserProfile | null;
    loading: boolean;
    refreshUser: () => Promise<void>;
    authError: string | null;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    refreshUser: async () => {},
    authError: null
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);

    const refreshUser = async () => {
        if (user?.uid) {
            try {
                const updatedProfile = await authService.getUserProfile(user.uid);
                setUser(updatedProfile);
            } catch (e: any) {
                console.error("Failed to refresh user", e);
            }
        }
    };

    useEffect(() => {
        let unsubscribe: any;

        const initAuth = async () => {
            try {
                unsubscribe = await authService.subscribeToAuth(async (firebaseUser) => {
                    if (firebaseUser) {
                        try {
                            // 1. Try to get existing profile
                            let profile = await authService.getUserProfile(firebaseUser.uid);
                            
                            // 2. If null (missing doc), attempt self-healing
                            if (!profile) {
                                console.warn("User profile missing in DB. Attempting to repair...");
                                profile = await authService.createProfileIfMissing(firebaseUser);
                            }
                            
                            setUser(profile);
                            setAuthError(null);
                        } catch (e: any) {
                            console.error("Auth Profile Error:", e);
                            if (e.message === 'FIREBASE_PERMISSION_DENIED') {
                                setAuthError('permission-denied');
                            } else {
                                // For other errors, we might still want to show an error or just fail
                                setAuthError(e.message || 'Unknown Auth Error');
                            }
                        }
                    } else {
                        setUser(null);
                        setAuthError(null);
                    }
                    setLoading(false);
                });
            } catch (e) {
                console.error("Auth init failed", e);
                setLoading(false);
            }
        };

        initAuth();

        return () => {
            if (unsubscribe && typeof unsubscribe === 'function') unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, refreshUser, authError }}>
            {children}
        </AuthContext.Provider>
    );
};
