'use client';

import { useTranslationStore } from '@/stores/i18nStore';
import { Languages } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function LanguageSwitch() {
    const { locale, setLocale } = useTranslationStore();
    const { t } = useTranslationStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    const toggleLanguage = () => {
        setLocale(locale === 'en' ? 'ar' : 'en');
    };

    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 p-2 px-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-soar-card rounded-lg transition-colors border border-soar-border"
            title={t('header.languageToggle')}
        >
            <Languages className="w-4 h-4" />
            <span className="hidden sm:inline">
                {locale === 'en' ? 'العربية' : 'English'}
            </span>
        </button>
    );
}
