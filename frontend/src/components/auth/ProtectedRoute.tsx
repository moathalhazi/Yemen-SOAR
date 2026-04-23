'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Shield } from 'lucide-react';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isLoading, isAuthenticated, router]);

    // Show a loading state while checking the token
    if (isLoading) {
        return (
            <div className="min-h-screen bg-soar-bg flex flex-col items-center justify-center">
                <Shield className="w-16 h-16 text-soar-accent animate-pulse" />
                <p className="mt-4 text-slate-400">Authenticating session...</p>
            </div>
        );
    }

    // Don't render protected content until confirmed authenticated
    if (!isAuthenticated) {
        return null;
    }

    return <>{children}</>;
}
