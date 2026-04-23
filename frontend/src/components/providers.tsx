'use client';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from 'next-themes';
import { useEffect } from 'react';
import { useTranslationStore } from '@/stores/i18nStore';
import { WebSocketProvider } from '@/components/providers/WebSocketProvider';

export function Providers({ children }: { children: React.ReactNode }) {
    const { locale } = useTranslationStore();

    useEffect(() => {
        document.documentElement.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
        document.documentElement.setAttribute('lang', locale);
        document.body.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');

        // Use the same font for both locales as requested by the user
        document.body.classList.add('font-cairo');
    }, [locale]);
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <AuthProvider>
                <WebSocketProvider>
                    <LocaleProvider>
                        {children}
                    </LocaleProvider>
                </WebSocketProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
