'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, Loader2, Info, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { alertsApi } from '@/lib/api';
import { useUIStore } from '@/stores';
import { useTranslationStore } from '@/stores/i18nStore';
import type { Alert } from '@/types';

export default function NotificationsDropdown() {
    const { t } = useTranslationStore();
    const [isOpen, setIsOpen] = useState(false);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { setActiveModule } = useUIStore();

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchNotifications = async () => {
        try {
            const response = await alertsApi.getAll({
                page_size: 5,
                status: 'new'
            });
            setAlerts(response.items || []);
            setUnreadCount(response.total || 0);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity.toLowerCase()) {
            case 'critical': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'high': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
            case 'medium': return <Info className="w-4 h-4 text-yellow-500" />;
            default: return <Info className="w-4 h-4 text-blue-500" />;
        }
    };

    return (
        <div ref={dropdownRef} className="relative inline-block">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-soar-card rounded-lg transition-colors group"
                title={t('header.notifications')}
            >
                <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 end-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                )}
            </button>

            {isOpen && (
                <div className="absolute end-0 mt-2 w-80 bg-soar-card border border-soar-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between p-3 border-b border-soar-border bg-soar-bg/50">
                        <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{t('notifications.title')}</h3>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{t('notifications.newAlerts', { count: unreadCount })}</span>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="w-5 h-5 animate-spin text-soar-accent" />
                            </div>
                        ) : alerts.length === 0 ? (
                            <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                                {t('notifications.noNotifications')}
                            </div>
                        ) : (
                            <div className="divide-y divide-soar-border">
                                {alerts.map((alert) => (
                                    <div key={alert.id} className="p-3 hover:bg-soar-bg transition-colors cursor-pointer group">
                                        <div className="flex gap-3">
                                            <div className="mt-1">
                                                {getSeverityIcon(alert.severity)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate group-hover:text-soar-accent transition-colors">
                                                    {alert.title}
                                                </p>
                                                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 line-clamp-2">
                                                    {alert.source_name} • {alert.status}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                                                    {formatRelativeTime((alert as any).received_at)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-2 border-t border-soar-border bg-soar-bg/50">
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                setActiveModule('alerts');
                            }}
                            className="block w-full text-center py-2 text-xs font-semibold text-soar-accent hover:bg-soar-card rounded-lg transition-colors"
                        >
                            {t('notifications.viewAll')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
