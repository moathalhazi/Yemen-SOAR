'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Filter, Download, MoreHorizontal, Eye, PlayCircle, ArrowUpRight,
    RefreshCw, Loader2, AlertTriangle, X, Check
} from 'lucide-react';
import { Header } from '@/components/layout';
import { DataTable, SeverityBadge, StatusBadge, Button, Modal } from '@/components/ui';
import { formatRelativeTime } from '@/lib/utils';
import { alertsApi, playbooksApi, incidentsApi } from '@/lib/api';
import type { Alert, AlertSeverity, AlertStatus, Playbook } from '@/types';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useAlertsData } from '@/hooks/useAlertsData';
import { useAlertsStore, useUIStore } from '@/stores';
import { useTranslationStore } from '@/stores/i18nStore';
import { Brain } from 'lucide-react';

export default function AlertsModule() {
    // State from store and hook
    const { alerts, selectedAlert, filters, pagination, isLoading, fetchAlerts, changeAlertStatus } = useAlertsData();
    const { setFilters, setPagination, setSelectedAlert } = useAlertsStore();
    const { openAIDrawer } = useUIStore();
    const { t } = useTranslationStore();

    // Local UI State
    const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [showPlaybookModal, setShowPlaybookModal] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showEscalateModal, setShowEscalateModal] = useState(false);
    const [escalateAlert, setEscalateAlert] = useState<Alert | null>(null);

    // Fetch playbooks for execution
    const fetchPlaybooks = async () => {
        try {
            const data = await playbooksApi.getAll();
            setPlaybooks(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Playbooks fetch error:', err);
        }
    };

    useEffect(() => {
        fetchAlerts();
        fetchPlaybooks();
    }, [fetchAlerts]);

    // Handle escalate to incident
    // Handle escalate click (opens modal)
    const handleEscalateClick = (alert: Alert) => {
        setEscalateAlert(alert);
        setShowEscalateModal(true);
    };

    // Confirm escalation
    const handleConfirmEscalation = async () => {
        if (!escalateAlert) return;

        setIsActionLoading(true);
        try {
            const incident = await alertsApi.escalateToIncident(escalateAlert.id);
            setSuccessMessage(`Alert escalated to incident: ${incident.id}`);
            setSelectedAlert(null);
            setShowEscalateModal(false);
            setEscalateAlert(null);
            fetchAlerts(); // Refresh

            // Auto-hide success message
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (err: any) {
            setShowEscalateModal(false); // Close modal on error so user can see the red toast
            setEscalateAlert(null);

            // Handle 401 specifically
            if (err.message && (err.message.includes('401') || err.message.includes('credentials'))) {
                setError('Your session has expired. Please log in again.');
            } else {
                setError(err instanceof Error ? err.message : 'Failed to escalate alert');
            }
        } finally {
            setIsActionLoading(false);
        }
    };

    // Handle run playbook
    const handleRunPlaybook = async (playbookId: string) => {
        if (!selectedAlert) return;

        setIsActionLoading(true);
        try {
            await playbooksApi.run(playbookId, { alert_id: selectedAlert.id });
            setSuccessMessage('Playbook execution started');
            setShowPlaybookModal(false);

            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to execute playbook');
        } finally {
            setIsActionLoading(false);
        }
    };

    // Handle update alert status
    const handleUpdateStatus = async (alertId: string, newStatus: AlertStatus) => {
        setIsActionLoading(true);
        try {
            await changeAlertStatus(alertId, newStatus);
            setSuccessMessage(`Alert status updated to ${newStatus}`);
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update alert');
        } finally {
            setIsActionLoading(false);
        }
    };

    // Handle export to CSV
    const handleExport = () => {
        const csv = [
            ['ID', 'Title', 'Severity', 'Status', 'Source', 'Category', 'Received At'].join(','),
            ...alerts.map(a => [
                a.id,
                `"${a.title.replace(/"/g, '""')}"`,
                a.severity,
                a.status,
                a.source_name,
                a.category || '',
                a.received_at
            ].join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alerts-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Clear filters
    const handleClearFilters = () => {
        setFilters({ severity: '', status: '', source: '' });
        setPagination({ ...pagination, page: 1 });
    };

    // Table columns
    const columns = [
        {
            key: 'title',
            header: t('alerts.columns.alert'),
            sortable: true,
            render: (alert: Alert) => (
                <div className="max-w-md">
                    <p className="font-medium truncate text-slate-900 dark:text-white">{alert.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{alert.category}</p>
                </div>
            ),
        },
        {
            key: 'severity',
            header: t('alerts.columns.severity'),
            sortable: true,
            width: 'w-24',
            render: (alert: Alert) => <SeverityBadge severity={alert.severity} />,
        },
        {
            key: 'status',
            header: t('alerts.columns.status'),
            sortable: true,
            width: 'w-28',
            render: (alert: Alert) => <StatusBadge status={alert.status} />,
        },
        {
            key: 'ai_priority_score',
            header: t('alerts.columns.priority'),
            sortable: true,
            width: 'w-20',
            render: (alert: Alert) => (
                <div className="flex items-center gap-2">
                    <div className="w-8 h-2 rounded-full bg-soar-card overflow-hidden">
                        <div
                            className={`h-full ${(alert.ai_priority_score || 0) > 70
                                ? 'bg-red-500'
                                : (alert.ai_priority_score || 0) > 40
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                                }`}
                            style={{ width: `${alert.ai_priority_score || 0}%` }}
                        />
                    </div>
                    <span className="text-xs text-slate-400">{alert.ai_priority_score || 0}</span>
                </div>
            ),
        },
        {
            key: 'source_name',
            header: t('alerts.columns.source'),
            sortable: true,
            render: (alert: Alert) => (
                <span className="text-slate-400">{alert.source_name}</span>
            ),
        },
        {
            key: 'received_at',
            header: t('alerts.columns.time'),
            sortable: true,
            width: 'w-28',
            render: (alert: Alert) => (
                <span className="text-slate-400">{formatRelativeTime(alert.received_at)}</span>
            ),
        },
        {
            key: 'actions',
            header: '',
            width: 'w-10',
            render: (alert: Alert) => (
                <button
                    className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded"
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAlert(alert);
                    }}
                >
                    <MoreHorizontal className="w-4 h-4" />
                </button>
            ),
        },
    ];

    return (
        <>
            <Header
                title={t('alerts.title')}
                subtitle={`${pagination.total ?? alerts.length} ${t('alerts.found')}`}
                actions={
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            icon={Loader2}
                            onClick={() => fetchAlerts()}
                            disabled={isLoading}
                        >
                            {t('alerts.refresh')}
                        </Button>
                        <Button
                            variant="secondary"
                            icon={Filter}
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            {t('alerts.filters')}
                        </Button>
                        <Button
                            variant="secondary"
                            icon={Download}
                            onClick={handleExport}
                            disabled={alerts.length === 0}
                        >
                            {t('alerts.export')}
                        </Button>
                    </div>
                }
            />

            <div className="space-y-4 mt-16">
                {/* Success Message */}
                {successMessage && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-400 flex items-center justify-between">
                        <p className="flex items-center gap-2">
                            <Check className="w-4 h-4" />
                            {successMessage}
                        </p>
                        <button onClick={() => setSuccessMessage(null)}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 flex items-center justify-between">
                        <p className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            {error}
                        </p>
                        <button onClick={() => setError(null)}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Filters */}
                {showFilters && (
                    <div className="card flex flex-wrap gap-4 animate-fade-in">
                        <select
                            value={filters.severity || ''}
                            onChange={(e) => {
                                setFilters({ severity: e.target.value as AlertSeverity | '' });
                                setPagination({ ...pagination, page: 1 });
                            }}
                            className="px-3 py-2 bg-soar-card border border-soar-border rounded-lg text-sm"
                        >
                            <option value="">{t('alerts.allSeverities')}</option>
                            <option value="critical">{t('dashboard.critical')}</option>
                            <option value="high">{t('dashboard.high')}</option>
                            <option value="medium">{t('dashboard.medium')}</option>
                            <option value="low">{t('dashboard.low')}</option>
                        </select>

                        <select
                            value={filters.status || ''}
                            onChange={(e) => {
                                setFilters({ status: e.target.value as AlertStatus | '' });
                                setPagination({ ...pagination, page: 1 });
                            }}
                            className="px-3 py-2 bg-soar-card border border-soar-border rounded-lg text-sm"
                        >
                            <option value="">{t('alerts.allStatuses')}</option>
                            <option value="new">New</option>
                            <option value="in_progress">{t('dashboard.inProgress')}</option>
                            <option value="resolved">{t('dashboard.resolved')}</option>
                            <option value="false_positive">{t('alerts.falsePositive')}</option>
                        </select>

                        <select
                            value={filters.source || ''}
                            onChange={(e) => {
                                setFilters({ source: e.target.value });
                                setPagination({ ...pagination, page: 1 });
                            }}
                            className="px-3 py-2 bg-soar-card border border-soar-border rounded-lg text-sm"
                        >
                            <option value="">{t('alerts.allSources')}</option>
                            <option value="Sophos Central">Sophos Central</option>
                            <option value="Sophos Firewall">Sophos Firewall</option>
                            <option value="Generic Syslog">Generic Syslog</option>
                        </select>

                        <Button variant="ghost" onClick={handleClearFilters}>
                            {t('alerts.clearFilters')}
                        </Button>
                    </div>
                )}

                {/* Loading State */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-soar-accent" />
                    </div>
                ) : alerts.length === 0 ? (
                    <div className="card text-center py-16">
                        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-slate-500" />
                        <h3 className="text-xl font-semibold mb-2">{t('alerts.noAlerts')}</h3>
                        <p className="text-slate-400">
                            {filters.severity || filters.status || filters.source
                                ? t('alerts.tryAdjusting')
                                : t('alerts.alertsWillAppear')}
                        </p>
                    </div>
                ) : (
                    <DataTable
                        columns={columns}
                        data={alerts}
                        keyExtractor={(alert) => alert.id}
                        onRowClick={setSelectedAlert}
                        pagination={{
                            page: pagination.page,
                            pageSize: pagination.pageSize,
                            total: pagination.total,
                            onPageChange: (newPage) => setPagination({ ...pagination, page: newPage }),
                        }}
                    />
                )}
            </div>

            {/* Alert Detail Modal */}
            <Modal
                isOpen={!!selectedAlert && !showPlaybookModal}
                onClose={() => setSelectedAlert(null)}
                title={t('alerts.alertDetails')}
                size="lg"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setSelectedAlert(null)}>
                            {t('alerts.close')}
                        </Button>
                        <PermissionGuard permissions="playbooks.execute">
                            <Button
                                variant="secondary"
                                icon={PlayCircle}
                                onClick={() => setShowPlaybookModal(true)}
                                disabled={isActionLoading}
                            >
                                {t('alerts.runPlaybook')}
                            </Button>
                        </PermissionGuard>
                        <PermissionGuard permissions="alerts.escalate">
                            <Button
                                icon={ArrowUpRight}
                                onClick={() => selectedAlert && handleEscalateClick(selectedAlert)}
                                disabled={isActionLoading || selectedAlert?.incident_id !== null}
                            >
                                {selectedAlert?.incident_id ? t('alerts.alreadyEscalated') : t('alerts.escalate')}
                            </Button>
                        </PermissionGuard>
                    </>
                }
            >
                {selectedAlert && (
                    <div className="space-y-6">
                        {/* Header */}
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <SeverityBadge severity={selectedAlert.severity} />
                                <StatusBadge status={selectedAlert.status} />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{selectedAlert.title}</h3>
                            <p className="text-slate-500 dark:text-slate-400 mt-2">{selectedAlert.description}</p>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleUpdateStatus(selectedAlert.id, 'in_progress')}
                                disabled={selectedAlert.status === 'in_progress' || isActionLoading}
                            >
                                {t('alerts.markInProgress')}
                            </Button>
                            <PermissionGuard permissions="alerts.close">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleUpdateStatus(selectedAlert.id, 'resolved')}
                                    disabled={selectedAlert.status === 'resolved' || isActionLoading}
                                >
                                    {t('alerts.markResolved')}
                                </Button>
                            </PermissionGuard>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleUpdateStatus(selectedAlert.id, 'false_positive')}
                                disabled={selectedAlert.status === 'false_positive' || isActionLoading}
                            >
                                {t('alerts.falsePositive')}
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openAIDrawer('alert', selectedAlert.id)}
                                className="ms-auto text-purple-400 hover:text-purple-300 border-purple-500/30 hover:bg-purple-500/10"
                            >
                                <Brain className="w-4 h-4 mr-2" />
                                {t('alerts.analyzeAI')}
                            </Button>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-slate-500">{t('alerts.fields.source')}</p>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{selectedAlert.source_name}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">{t('alerts.fields.category')}</p>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{selectedAlert.category || '-'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">{t('alerts.fields.externalId')}</p>
                                <p className="font-medium font-mono text-sm text-slate-900 dark:text-slate-100">{selectedAlert.external_id || '-'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">{t('alerts.fields.occurredAt')}</p>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{formatRelativeTime(selectedAlert.occurred_at)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">{t('alerts.fields.aiClassification')}</p>
                                <p className="font-medium capitalize text-slate-900 dark:text-slate-100">{selectedAlert.ai_classification || '-'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">{t('alerts.fields.aiConfidence')}</p>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{selectedAlert.ai_confidence ? `${selectedAlert.ai_confidence}%` : '-'}</p>
                            </div>
                        </div>

                        {/* Affected Assets */}
                        <div>
                            <p className="text-sm text-slate-500 mb-2">{t('alerts.fields.affectedAssets')}</p>
                            <div className="flex flex-wrap gap-2">
                                {Array.isArray(selectedAlert.affected_assets) && selectedAlert.affected_assets.map((asset, i) => (
                                    <span key={i} className="px-3 py-1 bg-soar-card rounded-lg text-sm border border-soar-border">
                                        <span className="text-slate-500">{asset.type}:</span> <span className="text-slate-900 dark:text-slate-100">{asset.identifier}</span>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Indicators */}
/* Indicators */
                        {selectedAlert.indicators && (
                            (Array.isArray(selectedAlert.indicators.ips) && selectedAlert.indicators.ips.length > 0) ||
                            (Array.isArray(selectedAlert.indicators.domains) && selectedAlert.indicators.domains.length > 0) ||
                            (Array.isArray(selectedAlert.indicators.hashes) && selectedAlert.indicators.hashes.length > 0)) && (
                                <div>
                                    <p className="text-sm text-slate-500 mb-2">{t('alerts.fields.ioc')}</p>
                                    <div className="space-y-2">
                                        {Array.isArray(selectedAlert.indicators.ips) && selectedAlert.indicators.ips.length > 0 && (
                                            <div className="flex gap-2">
                                                <span className="text-slate-400 text-sm">IPs:</span>
                                                {selectedAlert.indicators.ips.map((ip, i) => (
                                                    <span key={i} className="font-mono text-sm text-orange-400">{ip}</span>
                                                ))}
                                            </div>
                                        )}
                                        {Array.isArray(selectedAlert.indicators.domains) && selectedAlert.indicators.domains.length > 0 && (
                                            <div className="flex gap-2">
                                                <span className="text-slate-400 text-sm">Domains:</span>
                                                {selectedAlert.indicators.domains.map((d, i) => (
                                                    <span key={i} className="font-mono text-sm text-red-400">{d}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                        {/* Tags */}
                        <div>
                            <p className="text-sm text-slate-500 mb-2">{t('alerts.fields.tags')}</p>
                            <div className="flex flex-wrap gap-2">
                                {Array.isArray(selectedAlert.tags) && selectedAlert.tags.map((tag, i) => (
                                    <span key={i} className="px-2 py-1 bg-soar-accent/20 text-soar-accent rounded text-xs">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Playbook Selection Modal */}
            <Modal
                isOpen={showPlaybookModal}
                onClose={() => setShowPlaybookModal(false)}
                title={t('alerts.playbooks.select')}
                size="md"
            >
                <div className="space-y-3">
                    {playbooks.length === 0 ? (
                        <p className="text-slate-400 text-center py-4">{t('alerts.playbooks.none')}</p>
                    ) : (
                        playbooks.map((playbook) => (
                            <button
                                key={playbook.id}
                                onClick={() => handleRunPlaybook(playbook.id)}
                                disabled={isActionLoading}
                                className="w-full p-4 bg-soar-card rounded-lg hover:bg-soar-card/80 transition-colors text-left"
                            >
                                <p className="font-medium text-slate-900 dark:text-white">{playbook.name}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{playbook.description}</p>
                            </button>
                        ))
                    )}
                </div>
            </Modal>

            {/* Escalate Confirmation Modal */}
            <Modal
                isOpen={showEscalateModal}
                onClose={() => setShowEscalateModal(false)}
                title={t('alerts.escalation.title')}
                size="md"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setShowEscalateModal(false)} disabled={isActionLoading}>
                            {t('alerts.escalation.cancel')}
                        </Button>
                        <Button
                            variant="secondary" // Changed to secondary to match existing style, or primary if available
                            onClick={handleConfirmEscalation}
                            disabled={isActionLoading}
                            className="bg-soar-accent text-white hover:bg-soar-accent/90"
                        >
                            {isActionLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    {t('alerts.escalation.escalating')}
                                </>
                            ) : (
                                t('alerts.escalation.confirm')
                            )}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-soar-accent/10 mx-auto mb-4">
                        <ArrowUpRight className="w-6 h-6 text-soar-accent" />
                    </div>
                    <p className="text-center text-lg font-medium text-slate-900 dark:text-slate-100">{t('alerts.escalation.areYouSure')}</p>
                    <p className="text-center text-slate-500 dark:text-slate-400">
                        {t('alerts.escalation.description')} <span className="text-slate-900 dark:text-white font-medium">"{escalateAlert?.title}"</span>.
                        {t('alerts.escalation.descriptionPart2')}
                    </p>
                </div>
            </Modal>
        </>
    );
}
