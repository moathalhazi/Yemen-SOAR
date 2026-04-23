'use client';

import { useEffect, useState } from 'react';
import { Search, Download, Filter, Eye, ChevronDown } from 'lucide-react';
import { Header } from '@/components/layout';
import { Button, DataTable, Modal } from '@/components/ui';
import { useAuditStore, useAuthStore, useUIStore, hasPermission } from '@/stores';
import { auditLogsApi } from '@/lib/api';
import type { AuditLog } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import { Trash2, AlertTriangle } from 'lucide-react';
import { useTranslationStore } from '@/stores/i18nStore';

export default function AuditLogsModule() {
    const { t } = useTranslationStore();
    const { logs, setLogs, isLoading, setLoading } = useAuditStore();
    const { user } = useAuthStore();
    const { addNotification } = useUIStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isClearModalOpen, setIsClearModalOpen] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [severityFilter, setSeverityFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const params: Record<string, string> = {};
            if (searchQuery) params.search = searchQuery;
            if (severityFilter) params.severity = severityFilter;
            if (dateFrom) params.date_from = new Date(dateFrom).toISOString();
            if (dateTo) params.date_to = new Date(dateTo).toISOString();
            const response = await auditLogsApi.getAll(params);
            setLogs(Array.isArray(response) ? response : (response.items || []));
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [searchQuery, severityFilter, dateFrom, dateTo]);

    const handleExportCSV = () => {
        if (logs.length === 0) return;

        const header = ['Timestamp', 'User', 'Action', 'Entity Type', 'Status', 'Severity', 'IP Address'].join(',');
        const rows = logs.map(l =>
            [
                l.timestamp || '',
                l.username || '',
                l.action_type || '',
                l.entity_type || '',
                l.status || '',
                l.severity || '',
                l.ip_address || '',
            ]
                .map(v => `"${String(v).replace(/"/g, '""')}"`)
                .join(',')
        );
        const csvContent = [header, ...rows].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleClearLogs = async () => {
        try {
            setIsClearing(true);
            await auditLogsApi.clearAll();
            addNotification({
                type: 'success',
                message: t('audit.notifications.cleared'),
            });
            setIsClearModalOpen(false);
            fetchLogs(); // Refresh the list
        } catch (error: any) {
            console.error('Failed to clear logs:', error);
            addNotification({
                type: 'error',
                message: error.message || t('audit.notifications.clearFailed'),
            });
        } finally {
            setIsClearing(false);
        }
    };

    const isAdmin = user?.roles?.some(r => r.name === 'Administrator') || hasPermission(user, 'system.admin');

    const columns = [
        {
            key: 'timestamp',
            header: t('audit.table.timestamp'),
            sortable: true,
            render: (log: AuditLog) => (
                <span className="text-slate-600 dark:text-slate-300 text-sm">{formatRelativeTime(log.timestamp)}</span>
            ),
        },
        {
            key: 'user',
            header: t('audit.table.user'),
            render: (log: AuditLog) => (
                <span className="font-medium text-slate-900 dark:text-slate-200">{log.username}</span>
            ),
        },
        {
            key: 'action',
            header: t('audit.table.action'),
            render: (log: AuditLog) => (
                <span className="bg-soar-bg px-2 py-1 rounded text-xs font-mono text-slate-700 dark:text-slate-300 border border-soar-border">
                    {log.action_type}
                </span>
            ),
        },
        {
            key: 'module',
            header: t('audit.table.entityType'),
            render: (log: AuditLog) => (
                <span className="text-slate-500 dark:text-slate-400 text-sm">{log.entity_type}</span>
            ),
        },
        {
            key: 'severity',
            header: t('audit.table.severity'),
            render: (log: AuditLog) => {
                const colors: Record<string, string> = {
                    CRITICAL: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
                    WARNING: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
                    INFO: 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/20',
                };
                const colorClass = colors[log.severity] || colors.INFO;
                return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
                        {log.severity === 'CRITICAL' ? t('audit.severity.critical') :
                            log.severity === 'WARNING' ? t('audit.severity.warning') :
                                t('audit.severity.info')}
                    </span>
                );
            },
        },
        {
            key: 'ip',
            header: t('audit.table.ip'),
            render: (log: AuditLog) => (
                <span className="text-slate-500 dark:text-slate-400 text-sm font-mono">{log.ip_address || 'N/A'}</span>
            ),
        },
        {
            key: 'status',
            header: t('audit.table.status'),
            render: (log: AuditLog) => {
                const colors: Record<string, string> = {
                    success: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                    failed: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
                };
                const statusLower = log.status?.toLowerCase();
                const colorClass = colors[statusLower] || colors.success;
                return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
                        {statusLower === 'success' ? t('audit.status.success') :
                            statusLower === 'failed' ? t('audit.status.failed') :
                                t('audit.status.unknown')}
                    </span>
                );
            },
        },
        {
            key: 'actions',
            header: t('audit.table.actions'),
            render: (log: AuditLog) => (
                <button
                    onClick={() => { setSelectedLog(log); setIsModalOpen(true); }}
                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-soar-primary hover:bg-slate-700/50 rounded transition-colors"
                    title={t('audit.table.actions')}
                >
                    <Eye className="w-4 h-4" />
                </button>
            ),
        },
    ];

    return (
        <div className="flex flex-col h-full overflow-hidden bg-soar-bg">
            <Header
                title={t('audit.title')}
                subtitle={t('audit.subtitle')}
            />

            <div className="flex-1 overflow-auto p-4 md:p-6">
                <div className="max-w-7xl mx-auto space-y-6">

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400" />
                            <input
                                type="text"
                                placeholder={t('audit.searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full ps-9 pe-4 py-2 bg-soar-card border border-soar-border rounded-lg text-sm text-slate-900 dark:text-slate-200 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-soar-accent"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="secondary"
                                onClick={() => setShowFilters(!showFilters)}
                                icon={Filter}
                                iconPosition="left"
                            >
                                {t('audit.filters.label')}
                                <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={handleExportCSV}
                                icon={Download}
                                disabled={logs.length === 0}
                            >
                                {t('audit.actions.export')}
                            </Button>
                            {isAdmin && (
                                <Button
                                    variant="danger"
                                    onClick={() => setIsClearModalOpen(true)}
                                    icon={Trash2}
                                    className="bg-rose-500/10 text-rose-600 dark:text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/20 hover:border-rose-500"
                                    disabled={logs.length === 0}
                                >
                                    {t('audit.actions.clear')}
                                </Button>
                            )}
                        </div>
                    </div>

                    {showFilters && (
                        <div className="flex flex-wrap items-end gap-4 p-4 bg-soar-card/50 border border-soar-border rounded-lg">
                            <div>
                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('audit.filters.severity')}</label>
                                <select
                                    value={severityFilter}
                                    onChange={(e) => setSeverityFilter(e.target.value)}
                                    className="bg-soar-bg border border-soar-border rounded px-3 py-1.5 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-soar-accent"
                                >
                                    <option value="">{t('audit.filters.all')}</option>
                                    <option value="INFO">{t('audit.severity.info')}</option>
                                    <option value="WARNING">{t('audit.severity.warning')}</option>
                                    <option value="CRITICAL">{t('audit.severity.critical')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('audit.filters.from')}</label>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="bg-soar-bg border border-soar-border rounded px-3 py-1.5 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-soar-accent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('audit.filters.to')}</label>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="bg-soar-bg border border-soar-border rounded px-3 py-1.5 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-soar-accent"
                                />
                            </div>
                            <Button
                                variant="secondary"
                                onClick={() => { setSeverityFilter(''); setDateFrom(''); setDateTo(''); }}
                                className="text-xs"
                            >
                                {t('audit.filters.clear')}
                            </Button>
                        </div>
                    )}

                    <div className="bg-soar-card backdrop-blur-sm border border-soar-border rounded-lg overflow-hidden shrink-0">
                        <DataTable
                            columns={columns}
                            data={logs}
                            keyExtractor={(log) => log.id}
                            isLoading={isLoading}
                            emptyMessage={t('audit.emptyMessage')}
                        />
                    </div>
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={t('audit.modal.detailsTitle')}
                size="lg"
            >
                {selectedLog && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-soar-bg border border-soar-border p-3 rounded text-start">
                                <p className="text-xs text-slate-500 dark:text-slate-400">{t('audit.modal.actionEntity')}</p>
                                <p className="text-sm font-mono text-slate-900 dark:text-slate-200 mt-1">{selectedLog.action_type} - {selectedLog.entity_type}</p>
                            </div>
                            <div className="bg-soar-bg border border-soar-border p-3 rounded text-start">
                                <p className="text-xs text-slate-500 dark:text-slate-400">{t('audit.modal.severity')}</p>
                                <p className={`text-sm mt-1 uppercase ${selectedLog.severity === 'CRITICAL' ? 'text-rose-600 dark:text-rose-400' : selectedLog.severity === 'WARNING' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {selectedLog.severity}
                                </p>
                            </div>
                            <div className="bg-soar-bg border border-soar-border p-3 rounded text-start">
                                <p className="text-xs text-slate-500 dark:text-slate-400">{t('audit.modal.user')}</p>
                                <p className="text-sm text-slate-900 dark:text-slate-200 mt-1">{selectedLog.username}</p>
                            </div>
                            <div className="bg-soar-bg border border-soar-border p-3 rounded text-start">
                                <p className="text-xs text-slate-500 dark:text-slate-400">{t('audit.modal.status')}</p>
                                <p className="text-sm text-slate-900 dark:text-slate-200 mt-1 uppercase">{selectedLog.status}</p>
                            </div>
                            <div className="bg-soar-bg border border-soar-border p-3 rounded text-start">
                                <p className="text-xs text-slate-500 dark:text-slate-400">{t('audit.modal.ip')}</p>
                                <p className="text-sm text-slate-900 dark:text-slate-200 mt-1 font-mono">{selectedLog.ip_address || 'N/A'}</p>
                            </div>
                            <div className="bg-soar-bg border border-soar-border p-3 rounded text-start">
                                <p className="text-xs text-slate-500 dark:text-slate-400">{t('audit.modal.timestamp')}</p>
                                <p className="text-sm text-slate-900 dark:text-slate-200 mt-1">{selectedLog.timestamp ? new Date(selectedLog.timestamp).toLocaleString() : 'N/A'}</p>
                            </div>
                        </div>

                        <div className="bg-soar-bg border border-soar-border p-4 rounded mt-4 text-start">
                            <h4 className="text-xs uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-2">{t('audit.modal.rawPayload')}</h4>
                            <pre className="text-xs text-emerald-600 dark:text-emerald-400 overflow-x-auto p-2 bg-black/5 dark:bg-black/30 rounded border border-soar-border">
                                {JSON.stringify(selectedLog.details || { message: t('audit.modal.noDetails') }, null, 2)}
                            </pre>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                isOpen={isClearModalOpen}
                onClose={() => !isClearing && setIsClearModalOpen(false)}
                title={t('audit.clearModal.title')}
                size="md"
            >
                <div className="space-y-4">
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-start">
                            <h4 className="text-rose-600 dark:text-rose-400 font-medium mb-1">{t('audit.clearModal.warning')}</h4>
                            <p className="text-rose-600/80 dark:text-rose-400/80">
                                {t('audit.clearModal.description')}
                                <br /><br />
                                <strong className="text-rose-600 dark:text-rose-400 font-semibold">{t('audit.clearModal.note')}</strong>
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6 rtl:space-x-reverse">
                        <Button
                            variant="secondary"
                            onClick={() => setIsClearModalOpen(false)}
                            disabled={isClearing}
                        >
                            {t('audit.clearModal.cancel')}
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleClearLogs}
                            disabled={isClearing}
                            className="bg-rose-500 hover:bg-rose-600 text-white"
                        >
                            {isClearing ? t('audit.clearModal.clearing') : t('audit.clearModal.confirm')}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div >
    );
}
