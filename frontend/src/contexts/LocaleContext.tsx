'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface LocaleContextType {
    locale: string;
    timezone: string;
    direction: 'ltr' | 'rtl';
    setLocale: (locale: string) => void;
    setTimezone: (timezone: string) => void;
    formatDate: (date: string | Date, options?: Intl.DateTimeFormatOptions) => string;
    formatNumber: (number: number, options?: Intl.NumberFormatOptions) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
    // Default to system settings or fallbacks
    const [locale, setLocale] = useState('en-US');
    const [timezone, setTimezone] = useState('UTC'); // Default to UTC, will hydrate on client
    const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr');

    // Hydrate from localStorage or System on mount
    useEffect(() => {
        const savedLocale = localStorage.getItem('soar_locale');
        const savedTimezone = localStorage.getItem('soar_timezone');
        const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        if (savedLocale) {
            setLocale(savedLocale);
            setDirection(savedLocale.startsWith('ar') ? 'rtl' : 'ltr');
        } else {
            // Check navigator language
            const navLang = navigator.language;
            setLocale(navLang);
            setDirection(navLang.startsWith('ar') ? 'rtl' : 'ltr');
        }

        if (savedTimezone) {
            setTimezone(savedTimezone);
        } else {
            setTimezone(systemTimezone);
        }
    }, []);

    const updateLocale = (newLocale: string) => {
        setLocale(newLocale);
        setDirection(newLocale.startsWith('ar') ? 'rtl' : 'ltr');
        localStorage.setItem('soar_locale', newLocale);
    };

    const updateTimezone = (newTimezone: string) => {
        setTimezone(newTimezone);
        localStorage.setItem('soar_timezone', newTimezone);
    };

    const formatDate = (date: string | Date, options?: Intl.DateTimeFormatOptions) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        return new Intl.DateTimeFormat(locale, {
            timeZone: timezone,
            ...options
        }).format(d);
    };

    const formatNumber = (number: number, options?: Intl.NumberFormatOptions) => {
        return new Intl.NumberFormat(locale, options).format(number);
    };

    return (
        <LocaleContext.Provider value={{
            locale,
            timezone,
            direction,
            setLocale: updateLocale,
            setTimezone: updateTimezone,
            formatDate,
            formatNumber
        }}>
            <div className="contents">
                {children}
            </div>
        </LocaleContext.Provider>
    );
}

export const useLocale = () => {
    const context = useContext(LocaleContext);
    if (context === undefined) {
        throw new Error('useLocale must be used within a LocaleProvider');
    }
    return context;
};
