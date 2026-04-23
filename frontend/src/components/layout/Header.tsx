'use client';

import { useState } from 'react';
import { Search, Menu } from 'lucide-react';
import { useUIStore } from '@/stores';
import { cn } from '@/lib/utils';
import NotificationsDropdown from './NotificationsDropdown';
import ThemeToggle from './ThemeToggle';
import LanguageSwitch from './LanguageSwitch';
import { useTranslationStore } from '@/stores/i18nStore';


interface HeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
}

export default function Header({ title, subtitle, actions }: HeaderProps) {

    const { sidebarCollapsed, toggleMobileMenu } = useUIStore();
    const [searchQuery, setSearchQuery] = useState('');
    const { t } = useTranslationStore();

    return (
        <header className={cn(
            'fixed top-0 ltr:right-0 rtl:left-0 h-16 bg-soar-bg-secondary border-b border-soar-border z-30 flex items-center justify-between px-4 sm:px-6 transition-all duration-300',
            sidebarCollapsed ? 'ltr:left-0 ltr:lg:left-16 rtl:right-0 rtl:lg:right-16' : 'ltr:left-0 ltr:lg:left-64 rtl:right-0 rtl:lg:right-64'
        )}>
            {/* Left Section */}
            <div className="flex items-center gap-2 sm:gap-4">
                <button
                    onClick={toggleMobileMenu}
                    className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-soar-card rounded transition-colors"
                    title={t('navigation.menu')}
                >
                    <Menu className="w-5 h-5" />
                </button>
                <div className="hidden sm:block">
                    <h1 className="text-xl font-semibold">{title}</h1>
                    {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
                </div>
            </div>

            {/* Center - Search */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
                <div className="relative w-full">
                    <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder={t('header.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full ltr:pl-10 rtl:pr-10 ltr:pr-4 rtl:pl-4 py-2 bg-soar-card border border-soar-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-soar-accent focus:border-transparent transition-all"
                    />
                </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-1 sm:gap-2">
                <div className="hidden sm:flex items-center gap-2">
                    {actions}
                </div>

                <LanguageSwitch />
                <ThemeToggle />
                <NotificationsDropdown />
            </div>
        </header>
    );
}
