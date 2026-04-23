'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import { useAuthStore, useUIStore } from '@/stores';
import { setStoredAuth } from '@/lib/auth-storage';

export default function LoginPage() {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const { setAuth } = useAuthStore();
    const { setActiveModule } = useUIStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // If somehow already authenticated, redirect to prevent seeing login
    useEffect(() => {
        if (isAuthenticated) {
            router.push('/dashboard');
        }
    }, [isAuthenticated, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (email && password) {
                const response = await authApi.login({ username: email, password });
                setStoredAuth(response.user, response.access_token, rememberMe);

                setAuth(response.user, response.access_token);
                setActiveModule('dashboard');

                router.push('/dashboard');
            } else {
                setError('Please enter email and password');
            }
        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message || 'Invalid credentials. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-soar-bg flex">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-soar-accent to-cyan-700 p-12 flex-col justify-between">
                <div className="flex items-center gap-3">
                    <Shield className="w-10 h-10 text-white" />
                    <span className="text-2xl font-bold text-white">SOAR Pro</span>
                </div>

                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">
                        Security Orchestration, Automation & Response Platform
                    </h1>
                    <p className="text-lg text-white/90 font-medium leading-relaxed max-w-xl">
                        Enterprise-grade threat detection, automated investigation workflows, and centralized incident management designed for modern security operations centers.
                    </p>
                </div>

                <p className="text-sm font-medium text-white/70">
                    © {new Date().getFullYear()} SOAR Pro. All rights reserved.
                </p>
            </div>

            {/* Right Panel - Login Form */}
            <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
                        <Shield className="w-10 h-10 text-soar-accent" />
                        <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">SOAR Pro</span>
                    </div>

                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Welcome Back</h2>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-2">Sign in to your account securely</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="flex items-center gap-3 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm animate-fade-in font-medium">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Username or Email</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-soar-accent transition-colors" />
                                    <input
                                        type="text"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter your email"
                                        className="w-full h-12 pl-12 bg-white dark:bg-soar-card/60 border border-slate-300 dark:border-soar-border focus:border-soar-accent rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors shadow-sm"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-soar-accent transition-colors" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••••••"
                                        className="w-full h-12 pl-12 pr-12 bg-white dark:bg-soar-card/60 border border-slate-300 dark:border-soar-border focus:border-soar-accent rounded-xl text-sm tracking-wide text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:tracking-normal transition-colors shadow-sm"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-soar-accent transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <label className="flex items-center gap-2.5 cursor-pointer group">
                                <div className="relative flex items-center justify-center">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="w-4 h-4 rounded appearance-none border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-soar-card checked:bg-soar-accent checked:border-soar-accent transition-colors cursor-pointer"
                                    />
                                    {rememberMe && (
                                        <svg className="absolute w-3 h-3 text-white pointer-events-none" viewBox="0 0 14 14" fill="none">
                                            <path d="M3 8L5.5 10.5L11 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 border-slate-300 dark:group-hover:text-slate-200 transition-colors">Remember me</span>
                            </label>
                            <a href="/forgot-password" className="text-sm font-semibold text-soar-accent hover:text-soar-accent/80 transition-colors">
                                Forgot password?
                            </a>
                        </div>

                        <div className="pt-4">
                            <Button type="submit" className="w-full h-12 text-base font-bold rounded-xl shadow-lg shadow-soar-accent/25 hover:shadow-soar-accent/40 transition-shadow" isLoading={isLoading}>
                                Sign In
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
