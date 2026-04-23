'use client';

import { useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    AlertTriangle,
    FileWarning,
    PlayCircle,
    FileSearch,
    Settings,
    Shield,
    ChevronLeft,
    ChevronRight,
    Users,
    User,
    Plug,
    FileText,
    LogOut,
    History,
    ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore, useAuthStore } from '@/stores';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslationStore } from '@/stores/i18nStore';

type NavItem = {
    name: string;
    id: string;
    icon: any;
    permission?: string;
};

const navigation: NavItem[] = [
    { name: 'Dashboard', id: 'dashboard', icon: LayoutDashboard },
    { name: 'Alerts', id: 'alerts', icon: AlertTriangle, permission: 'alerts.read' },
    { name: 'Incidents', id: 'incidents', icon: FileWarning, permission: 'incidents.read' },
    { name: 'Playbooks', id: 'playbooks', icon: PlayCircle, permission: 'playbooks.read' },
    { name: 'Evidence', id: 'evidence', icon: FileSearch, permission: 'evidence.read' },
    { name: 'Compliance', id: 'compliance', icon: FileText, permission: 'dashboard.view' },
];

const settingsNav: NavItem[] = [
    { name: 'Reports', id: 'reports', icon: ClipboardList, permission: 'reports.read' },
    { name: 'Audit Logs', id: 'audit-logs', icon: History, permission: 'audit_logs.read' },
    { name: 'My Profile', id: 'profile', icon: User },
    { name: 'User Management', id: 'user-management', icon: Users, permission: 'users.manage' },
    { name: 'Roles & Permissions', id: 'roles-permissions', icon: Shield, permission: 'roles.manage' },
    { name: 'Integrations', id: 'integrations', icon: Plug, permission: 'dashboard.view' },
    { name: 'System', id: 'system', icon: Settings, permission: 'system.settings.manage' },
];

export default function Sidebar() {
    const router = useRouter();
    const { sidebarCollapsed, toggleSidebar, isMobileMenuOpen, closeMobileMenu, activeModule, setActiveModule } = useUIStore();
    const { user } = useAuthStore();
    const { logout } = useAuth();
    const { t } = useTranslationStore();

    const hasPermission = (permission?: string) => {
        if (!permission) return true;
        if (!user) return false;
        return user.permissions?.includes(permission) ?? false;
    };

    const handleNavigation = (id: any) => {
        setActiveModule(id);

        // Auto-close mobile menu on navigation
        if (isMobileMenuOpen) {
            closeMobileMenu();
        }

        // Ensure we are on the root dashboard page
        if (window.location.pathname !== '/dashboard') {
            router.push('/dashboard');
        }
    };

    return (
        <aside
            className={cn(
                'fixed ltr:left-0 rtl:right-0 top-0 h-full bg-soar-bg-secondary ltr:border-r rtl:border-l border-soar-border z-40 transition-transform duration-300 ease-in-out flex flex-col',
                sidebarCollapsed ? 'lg:w-16' : 'w-64',
                isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:translate-x-0 lg:rtl:translate-x-0'
            )}
        >
            <div className="h-16 flex items-center justify-between px-4 border-b border-soar-border flex-shrink-0">
                {!sidebarCollapsed && (
                    <div className="flex items-center gap-2">
                        <Shield className="w-8 h-8 text-soar-accent" />
                        <span className="font-bold text-xl">SOAR Pro</span>
                    </div>
                )}
                {sidebarCollapsed && <Shield className="hidden lg:block w-8 h-8 text-soar-accent mx-auto" />}

                {/* Desktop Toggle Button */}
                <button
                    onClick={toggleSidebar}
                    className="hidden lg:block p-1 rounded hover:bg-soar-card transition-colors"
                >
                    {sidebarCollapsed ? <ChevronRight className="w-5 h-5 rtl:-scale-x-100" /> : <ChevronLeft className="w-5 h-5 rtl:-scale-x-100" />}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <nav className="p-4 space-y-1">
                    {!sidebarCollapsed && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('navigation.main')}</p>}
                    {navigation.map((item) => {
                        if (!hasPermission(item.permission)) return null;
                        const isActive = activeModule === item.id;
                        return (
                            <button
                                key={item.name}
                                onClick={() => handleNavigation(item.id)}
                                className={cn(
                                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-start',
                                    isActive ? 'bg-soar-accent text-white' : 'text-black dark:text-slate-400 hover:bg-soar-card',
                                    (sidebarCollapsed && !isMobileMenuOpen) ? 'lg:justify-center' : ''
                                )}
                                title={(sidebarCollapsed && !isMobileMenuOpen) ? t(`navigation.${item.id}`) : undefined}
                            >
                                <item.icon className="w-5 h-5 flex-shrink-0" />
                                {(!sidebarCollapsed || isMobileMenuOpen) && <span>{t(`navigation.${item.id}`)}</span>}
                            </button>
                        );
                    })}
                </nav>

                <nav className="p-4 space-y-1 border-t border-soar-border">
                    {!sidebarCollapsed && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('navigation.settings')}</p>}
                    {settingsNav.map((item) => {
                        if (!hasPermission(item.permission)) return null;
                        const isActive = activeModule === item.id;
                        return (
                            <button
                                key={item.name}
                                onClick={() => handleNavigation(item.id)}
                                className={cn(
                                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-start',
                                    isActive ? 'bg-soar-accent text-white' : 'text-black dark:text-slate-400 hover:bg-soar-card',
                                    (sidebarCollapsed && !isMobileMenuOpen) ? 'lg:justify-center' : ''
                                )}
                                title={(sidebarCollapsed && !isMobileMenuOpen) ? t(`navigation.${item.id}`) : undefined}
                            >
                                <item.icon className="w-5 h-5 flex-shrink-0" />
                                {(!sidebarCollapsed || isMobileMenuOpen) && <span>{t(`navigation.${item.id}`)}</span>}
                            </button>
                        );
                    })}
                </nav>
            </div>

            <div className="mt-auto inset-x-0 p-4 border-t border-soar-border bg-soar-bg-secondary">
                {(!sidebarCollapsed || isMobileMenuOpen) ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-soar-accent flex items-center justify-center">
                                <span className="text-sm font-semibold">{user?.full_name?.[0] || user?.username?.[0] || 'A'}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{user?.full_name || user?.username || 'Admin'}</p>
                                <p className="text-xs text-slate-500 truncate">{user?.email || 'admin@soarpro.local'}</p>
                            </div>
                        </div>
                        <button onClick={logout} className="p-2 text-black dark:text-slate-400 hover:bg-soar-card rounded transition-colors flex-shrink-0" title="Logout">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <button onClick={logout} className="hidden lg:flex w-full p-2 text-black dark:text-slate-400 hover:bg-soar-card rounded transition-colors justify-center" title="Logout">
                        <LogOut className="w-5 h-5" />
                    </button>
                )}
            </div>
        </aside>
    );
}
