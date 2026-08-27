
import React, { createContext, useContext, useState } from 'react';
import { UserProfile } from '../types';

export const DEFAULT_USER: UserProfile = {
    uid: 'admin_master',
    email: 'admin@cambiodigital.com',
    displayName: 'Administrador',
    role: 'admin',
    permissions: {
        canAccessChronos: true,
        canAccessPayroll: true,
        canAccessRevenue: true,
        canAccessWallet: true,
        canAccessBudgets: true,
        canAccessPolisher: true,
        canAccessMeetings: true
    },
    createdAt: Date.now()
};

interface AuthContextType {
    user: UserProfile | null;
    loading: boolean;
    refreshUser: () => Promise<void>;
    authError: string | null;
}

const AuthContext = createContext<AuthContextType>({
    user: DEFAULT_USER,
    loading: false,
    refreshUser: async () => {},
    authError: null
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserProfile | null>(DEFAULT_USER);
    const [loading] = useState(false);
    const [authError] = useState<string | null>(null);

    const refreshUser = async () => {
        setUser(DEFAULT_USER);
    };

    return (
        <AuthContext.Provider value={{ user, loading, refreshUser, authError }}>
            {children}
        </AuthContext.Provider>
    );
};

