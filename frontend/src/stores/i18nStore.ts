import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import enDict from '../locales/en.json';
import arDict from '../locales/ar.json';

type Locale = 'en' | 'ar';

// Always resolve dictionary from the imported JSON modules, never from persisted state
const getDictionary = (locale: Locale) => locale === 'ar' ? arDict : enDict;

interface TranslationState {
    locale: Locale;
    setLocale: (newLocale: Locale) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
}

export const useTranslationStore = create<TranslationState>()(
    persist(
        (set, get) => ({
            locale: 'en',
            setLocale: (newLocale) => set({ locale: newLocale }),
            t: (key: string, params?: Record<string, string | number>) => {
                const state = get();
                const dictionary = getDictionary(state.locale);
                const keys = key.split('.');
                let value: any = dictionary;

                for (const k of keys) {
                    if (value && typeof value === 'object') {
                        value = value[k];
                    } else {
                        return key;
                    }
                }

                if (typeof value !== 'string') return key;

                if (params) {
                    Object.entries(params).forEach(([k, v]) => {
                        value = value.replace(`{${k}}`, String(v));
                    });
                }

                return value;
            }
        }),
        {
            name: 'soar-language-preference',
            partialize: (state) => ({ locale: state.locale }),
        }
    )
);
