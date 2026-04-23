'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslationStore } from '@/stores/i18nStore';

export default function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const { t } = useTranslationStore();
    const [mounted, setMounted] = useState(false);

    // Prevent hydration mismatch
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    return (
        <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 text-slate-400 hover:text-white hover:bg-soar-card rounded-lg transition-colors"
            title={t('header.themeToggle')}
        >
            {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
            ) : (
                <Moon className="w-5 h-5" />
            )}
        </button>
    );
}
