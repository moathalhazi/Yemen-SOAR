'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { clearStoredAuth, getStoredToken, getStoredUser, syncStoredUser } from '@/lib/auth-storage';
import { useAuthStore } from '@/stores';

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    isAuthenticated: false,
    isLoading: true,
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, setAuth, logout: storeLogout } = useAuthStore();
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const token = getStoredToken();
        const user = getStoredUser();

        if (token && user) {
            setAuth(user as any, token);

            fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => res.ok ? res.json() : Promise.reject(res))
                .then(freshUser => {
                    setAuth(freshUser, token);
                    syncStoredUser(freshUser);
                })
                .catch(() => {
                    void handleLogout();
                });
        }

        setIsLoading(false);
    }, [setAuth]);

    const handleLogout = async () => {
        try {
            await authApi.logout();
        } catch (error) {
            console.error('Logout request failed, clearing client session anyway', error);
        } finally {
            storeLogout();
            clearStoredAuth();
            router.push('/login');
        }
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, isLoading, logout: handleLogout }}>
            {children}
        </AuthContext.Provider>
    );
}
