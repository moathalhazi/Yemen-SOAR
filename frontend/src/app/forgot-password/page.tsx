'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Shield, Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { authApi } from '@/lib/api';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setStatus('idle');

        try {
            await authApi.forgotPassword(email);
            setStatus('success');
            setMessage('If an account exists with this email, you will receive a password reset link shortly.');
        } catch (err: any) {
            setStatus('error');
            setMessage(err.message || 'Failed to request password reset. Please try again.');
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
                    <h1 className="text-4xl font-bold text-white mb-4">Account Recovery</h1>
                    <p className="text-lg text-white/80">
                        Securely recover access to your account using our encrypted password reset flow.
                    </p>
                </div>
                <p className="text-sm text-white/60">© 2024 SOAR Pro. All rights reserved.</p>
            </div>

            {/* Right Panel - Form */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <Link href="/login" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6">
                            <ArrowLeft className="w-4 h-4" />
                            Back to Login
                        </Link>
                        <h2 className="text-2xl font-bold mb-2">Forgot Password?</h2>
                        <p className="text-slate-400">Enter your email to receive a reset link</p>
                    </div>

                    {status === 'success' ? (
                        <div className="text-center p-6 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-green-500 mb-2">Check your email</h3>
                            <p className="text-sm text-slate-300">{message}</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {status === 'error' && (
                                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm animate-fade-in">
                                    <AlertCircle className="w-4 h-4" />
                                    {message}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium mb-2">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="name@company.com"
                                        className="w-full pl-10"
                                        required
                                    />
                                </div>
                            </div>

                            <Button type="submit" className="w-full" isLoading={isLoading}>
                                Send Reset Link
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
