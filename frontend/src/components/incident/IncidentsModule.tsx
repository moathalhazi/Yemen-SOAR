'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Plus, Filter, Clock, Users, AlertTriangle, CheckCircle,
    RefreshCw, Loader2, X, Check
} from 'lucide-react';
import { Header } from '@/components/layout';
import { DataTable, SeverityBadge, StatusBadge, Button, Modal, PriorityBadge } from '@/components/ui';
import { formatRelativeTime, formatDuration } from '@/lib/utils';
import { incidentsApi } from '@/lib/api';
import type { Incident, IncidentSeverity, IncidentStatus } from '@/types';
import { useIncidentsData } from '@/hooks/useIncidentsData';
import { useIncidentsStore, useUIStore } from '@/stores';
import { useTranslationStore } from '@/stores/i18nStore';
import { Brain } from 'lucide-react';
import MITRETaggingSystem from './MITRETaggingSystem';
import MITREAttackMap from './MITREAttackMap';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function IncidentsModule() {
    // State from store and hook
    const { incidents, selectedIncident, isLoading, fetchIncidents } = useIncidentsData();
    const { setSelectedIncident } = useIncidentsStore();
    const { openAIDrawer } = useUIStore();
    const { t } = useTranslationStore();
    // Local UI State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);
    const [total, setTotal] = useState(0);

    // Create form state
    const [newIncident, setNewIncident] = useState({
        title: '',
        description: '',
        severity: 'medium' as IncidentSeverity,
        priority: 3,
        category: '',
    });

    // Fetch incidents wrapper
    const loadIncidents = useCallback(async () => {
        setError(null);
        try {
            const response = await fetchIncidents({
                page,
                page_size: pageSize,
            });
            setTotal(response.total || 0);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load incidents');
        }
    }, [page, pageSize, fetchIncidents]);

    useEffect(() => {
        loadIncidents();
    }, [loadIncidents]);

    // Handle create incident
    const handleCreateIncident = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newIncident.title.trim()) {
            setError('Title is required');
            return;
        }

        setIsActionLoading(true);
        try {
            await incidentsApi.create({
                title: newIncident.title,
                description: newIncident.description,
                severity: newIncident.severity,
                priority: newIncident.priority,
                category: newIncident.category,
                status: 'open',
            });

            setSuccessMessage('Incident created successfully');
            setShowCreateModal(false);
            setNewIncident({ title: '', description: '', severity: 'medium', priority: 3, category: '' });
            loadIncidents();

            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create incident');
        } finally {
            setIsActionLoading(false);
        }
    };

    // Handle update incident status
    const handleUpdateStatus = async (incidentId: string, newStatus: IncidentStatus) => {
        setIsActionLoading(true);
        try {
            await incidentsApi.update(incidentId, { status: newStatus });
            setSuccessMessage(`Incident status updated to ${newStatus}`);
            loadIncidents();
            setSelectedIncident(null);

            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update incident');
        } finally {
            setIsActionLoading(false);
        }
    };

    // Table columns
    const columns = [
        {
            key: 'incident_number',
            header: '#',
            width: 'w-16',
            sortable: true,
            render: (inc: Incident) => (
                <span className="font-mono text-soar-accent">#{inc.incident_number}</span>
            ),
        },
        {
            key: 'title',
            header: t('incidents.columns.incident'),
            sortable: true,
            render: (inc: Incident) => (
                <div className="max-w-md">
                    <p className="font-medium truncate">{inc.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{inc.category} • {inc.incident_type}</p>
                </div>
            ),
        },
        {
            key: 'priority',
            header: t('incidents.columns.priority'),
            sortable: true,
            width: 'w-20',
            render: (inc: Incident) => <PriorityBadge priority={inc.priority} />,
        },
        {
            key: 'severity',
            header: t('incidents.columns.severity'),
            sortable: true,
            width: 'w-24',
            render: (inc: Incident) => <SeverityBadge severity={inc.severity} />,
        },
        {
            key: 'status',
            header: t('incidents.columns.status'),
            sortable: true,
            width: 'w-28',
            render: (inc: Incident) => <StatusBadge status={inc.status} />,
        },
        {
            key: 'team',
            header: t('incidents.columns.team'),
            render: (inc: Incident) => (
                <span className="text-slate-400">{inc.team || '-'}</span>
            ),
        },
        {
            key: 'mttr_seconds',
            header: t('incidents.columns.mttr'),
            sortable: true,
            width: 'w-24',
            render: (inc: Incident) => (
                <span className="text-slate-400">{formatDuration(inc.mttr_seconds)}</span>
            ),
        },
        {
            key: 'detected_at',
            header: t('incidents.columns.detected'),
            sortable: true,
            width: 'w-28',
            render: (inc: Incident) => (
                <span className="text-slate-400">{formatRelativeTime(inc.detected_at)}</span>
            ),
        },
    ];

    // Calculate counts
    const openCount = incidents.filter(i => i.status === 'open').length;
    const investigatingCount = incidents.filter(i => i.status === 'investigating').length;
    const containedCount = incidents.filter(i => i.status === 'contained').length;
    const closedCount = incidents.filter(i => i.status === 'closed' || i.status === 'recovered').length;

    return (
        <>
            <Header
                title={t('incidents.title')}
                subtitle={`${total} ${t('incidents.totalIncidents')}`}
                actions={
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            icon={isLoading ? Loader2 : RefreshCw}
                            onClick={loadIncidents}
                            disabled={isLoading}
                        >
                            {t('incidents.refresh')}
                        </Button>
                        <PermissionGuard permissions="incidents.create">
                            <Button icon={Plus} onClick={() => setShowCreateModal(true)}>
                                {t('incidents.newIncident')}
                            </Button>
                        </PermissionGuard>
                    </div>
                }
            />

            <div className="space-y-6 mt-16">
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

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="card flex items-center gap-4">
                        <div className="p-3 bg-red-500/20 rounded-lg">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{openCount + investigatingCount}</p>
                            <p className="text-sm text-slate-400">{t('incidents.summary.active')}</p>
                        </div>
                    </div>
                    <div className="card flex items-center gap-4">
                        <div className="p-3 bg-orange-500/20 rounded-lg">
                            <Clock className="w-6 h-6 text-orange-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{investigatingCount}</p>
                            <p className="text-sm text-slate-400">{t('incidents.summary.investigating')}</p>
                        </div>
                    </div>
                    <div className="card flex items-center gap-4">
                        <div className="p-3 bg-blue-500/20 rounded-lg">
                            <Users className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{containedCount}</p>
                            <p className="text-sm text-slate-400">{t('incidents.summary.contained')}</p>
                        </div>
                    </div>
                    <div className="card flex items-center gap-4">
                        <div className="p-3 bg-green-500/20 rounded-lg">
                            <CheckCircle className="w-6 h-6 text-green-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{closedCount}</p>
                            <p className="text-sm text-slate-400">{t('incidents.summary.closed')}</p>
                        </div>
                    </div>
                </div>

                {/* Loading State */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-soar-accent" />
                    </div>
                ) : incidents.length === 0 ? (
                    <div className="card text-center py-16">
                        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-slate-500" />
                        <h3 className="text-xl font-semibold mb-2">{t('incidents.noIncidents')}</h3>
                        <p className="text-slate-400 mb-4">
                            {t('incidents.createFirst')}
                        </p>
                        <PermissionGuard permissions="incidents.create">
                            <Button icon={Plus} onClick={() => setShowCreateModal(true)}>
                                {t('incidents.createIncident')}
                            </Button>
                        </PermissionGuard>
                    </div>
                ) : (
                    <DataTable
                        columns={columns}
                        data={incidents}
                        keyExtractor={(inc) => inc.id}
                        onRowClick={setSelectedIncident}
                        pagination={{
                            page,
                            pageSize,
                            total,
                            onPageChange: setPage,
                        }}
                    />
                )}
            </div>

            {/* Incident Detail Modal */}
            <Modal
                isOpen={!!selectedIncident}
                onClose={() => setSelectedIncident(null)}
                title={`Incident #${selectedIncident?.incident_number}`}
                size="xl"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setSelectedIncident(null)}>
                            {t('incidents.details.close')}
                        </Button>
                        <PermissionGuard permissions="incidents.update">
                            <Button
                                onClick={() => selectedIncident && handleUpdateStatus(selectedIncident.id, 'investigating')}
                                disabled={isActionLoading || selectedIncident?.status === 'investigating'}
                            >
                                {t('incidents.details.startInvestigation')}
                            </Button>
                        </PermissionGuard>
                    </>
                }
            >
                {selectedIncident && (
                    <div className="space-y-6">
                        {/* Header */}
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <PriorityBadge priority={selectedIncident.priority} />
                                <SeverityBadge severity={selectedIncident.severity} />
                                <StatusBadge status={selectedIncident.status} />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{selectedIncident.title}</h3>
                            <p className="text-slate-500 dark:text-slate-400 mt-2">{selectedIncident.description}</p>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex flex-wrap gap-2">
                            <PermissionGuard permissions="incidents.update">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleUpdateStatus(selectedIncident.id, 'contained')}
                                    disabled={selectedIncident.status === 'contained' || isActionLoading}
                                >
                                    Mark Contained
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleUpdateStatus(selectedIncident.id, 'eradicated')}
                                    disabled={selectedIncident.status === 'eradicated' || isActionLoading}
                                >
                                    {t('incidents.details.markEradicated')}
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleUpdateStatus(selectedIncident.id, 'recovered')}
                                    disabled={selectedIncident.status === 'recovered' || isActionLoading}
                                >
                                    Mark Recovered
                                </Button>
                            </PermissionGuard>
                            <PermissionGuard permissions="incidents.close">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleUpdateStatus(selectedIncident.id, 'closed')}
                                    disabled={selectedIncident.status === 'closed' || isActionLoading}
                                >
                                    Close Incident
                                </Button>
                            </PermissionGuard>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openAIDrawer('incident', selectedIncident.id)}
                                className="ms-auto text-purple-400 hover:text-purple-300 border-purple-500/30 hover:bg-purple-500/10"
                            >
                                <Brain className="w-4 h-4 mr-2" />
                                {t('incidents.details.analyzeAI')}
                            </Button>
                        </div>

                        {/* Status Timeline */}
                        <div>
                            <p className="text-sm text-slate-500 mb-3">{t('incidents.details.statusTimeline')}</p>
                            <div className="flex items-center gap-2">
                                {['open', 'investigating', 'contained', 'eradicated', 'recovered', 'closed'].map((status, idx) => {
                                    const statusOrder = ['open', 'investigating', 'contained', 'eradicated', 'recovered', 'closed'];
                                    const currentIdx = statusOrder.indexOf(selectedIncident.status);
                                    const isCompleted = idx <= currentIdx;
                                    const isCurrent = status === selectedIncident.status;

                                    return (
                                        <div key={status} className="flex items-center gap-2">
                                            <div
                                                className={`w-3 h-3 rounded-full ${isCompleted
                                                    ? isCurrent
                                                        ? 'bg-soar-accent status-pulse'
                                                        : 'bg-green-500'
                                                    : 'bg-soar-card'
                                                    }`}
                                            />
                                            {idx < 5 && (
                                                <div
                                                    className={`w-8 h-0.5 ${idx < currentIdx ? 'bg-green-500' : 'bg-soar-card'}`}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-slate-500">
                                <span>{t('incidents.summary.open')}</span>
                                <span>{t('incidents.summary.investigating')}</span>
                                <span>{t('incidents.summary.contained')}</span>
                                <span>{t('incidents.summary.eradicated')}</span>
                                <span>{t('incidents.summary.recovered')}</span>
                                <span>{t('incidents.summary.closed')}</span>
                            </div>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 bg-soar-card border border-soar-border rounded-lg">
                                <p className="text-sm text-slate-500">{t('incidents.details.metrics.mttd')}</p>
                                <p className="text-xl font-bold mt-1 text-slate-900 dark:text-slate-100">{formatDuration(selectedIncident.mttd_seconds)}</p>
                            </div>
                            <div className="p-4 bg-soar-card border border-soar-border rounded-lg">
                                <p className="text-sm text-slate-500">{t('incidents.details.metrics.mttr')}</p>
                                <p className="text-xl font-bold mt-1 text-slate-900 dark:text-slate-100">{formatDuration(selectedIncident.mttr_seconds)}</p>
                            </div>
                            <div className="p-4 bg-soar-card border border-soar-border rounded-lg">
                                <p className="text-sm text-slate-500">{t('incidents.details.metrics.mtte')}</p>
                                <p className="text-xl font-bold mt-1 text-slate-900 dark:text-slate-100">{formatDuration(selectedIncident.mtte_seconds)}</p>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-slate-500">{t('incidents.details.fields.assignedTeam')}</p>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{selectedIncident.team || '-'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">{t('incidents.details.fields.attackVector')}</p>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{selectedIncident.attack_vector || '-'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">{t('incidents.details.fields.businessImpact')}</p>
                                <p className="font-medium capitalize text-slate-900 dark:text-slate-100">{selectedIncident.business_impact || '-'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">{t('incidents.details.fields.evidenceCollectedField')}</p>
                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                    {selectedIncident.evidence_collected
                                        ? `${t('incidents.details.fields.evidenceYes')} (${selectedIncident.evidence_ids?.length || 0} ${t('incidents.details.fields.items')})`
                                        : t('incidents.details.fields.evidenceNo')}
                                </p>
                            </div>
                        </div>

                        {/* MITRE Techniques Mapping */}
                        <div className="pt-4 border-t border-soar-border">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-semibold text-slate-500">{t('incidents.details.fields.tacticsAndTechniques')}</p>
                            </div>

                            <MITRETaggingSystem
                                incidentId={selectedIncident.id}
                                currentTechniques={selectedIncident.mitre_techniques || []}
                                onUpdate={(newTags) => setSelectedIncident({ ...selectedIncident, mitre_techniques: newTags })}
                                className="mb-4"
                            />

                            <MITREAttackMap
                                techniques={selectedIncident.mitre_techniques || []}
                            />
                        </div>

                        {/* Tags */}
                        {selectedIncident.tags && selectedIncident.tags.length > 0 && (
                            <div>
                                <p className="text-sm text-slate-500 mb-2">{t('incidents.details.fields.tags')}</p>
                                <div className="flex flex-wrap gap-2">
                                    {selectedIncident.tags.map((tag, i) => (
                                        <span
                                            key={i}
                                            className="px-2 py-1 bg-soar-accent/20 text-soar-accent rounded text-xs"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Create Incident Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title={t('incidents.createModal.title')}
                size="lg"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                            {t('incidents.createModal.cancel')}
                        </Button>
                        <Button
                            onClick={handleCreateIncident}
                            disabled={isActionLoading || !newIncident.title.trim()}
                        >
                            {isActionLoading ? t('incidents.createModal.creating') : t('incidents.createModal.confirm')}
                        </Button>
                    </>
                }
            >
                <form onSubmit={handleCreateIncident} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">{t('incidents.createModal.fields.title')}</label>
                        <input
                            type="text"
                            placeholder={t('incidents.createModal.fields.titlePlaceholder')}
                            value={newIncident.title}
                            onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
                            className="w-full px-3 py-2 bg-soar-card border border-soar-border rounded-lg text-slate-900 dark:text-white"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">{t('incidents.createModal.fields.description')}</label>
                        <textarea
                            placeholder={t('incidents.createModal.fields.descriptionPlaceholder')}
                            rows={3}
                            value={newIncident.description}
                            onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                            className="w-full px-3 py-2 bg-soar-card border border-soar-border rounded-lg text-slate-900 dark:text-slate-100"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">{t('incidents.createModal.fields.severity')}</label>
                            <select
                                value={newIncident.severity}
                                onChange={(e) => setNewIncident({ ...newIncident, severity: e.target.value as IncidentSeverity })}
                                className="w-full px-3 py-2 bg-soar-card border border-soar-border rounded-lg text-slate-900 dark:text-slate-100"
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">{t('incidents.createModal.fields.priority')}</label>
                            <select
                                value={newIncident.priority}
                                onChange={(e) => setNewIncident({ ...newIncident, priority: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 bg-soar-card border border-soar-border rounded-lg text-slate-900 dark:text-slate-100"
                            >
                                <option value="1">P1 - Critical</option>
                                <option value="2">P2 - High</option>
                                <option value="3">P3 - Medium</option>
                                <option value="4">P4 - Low</option>
                                <option value="5">P5 - Info</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">{t('incidents.createModal.fields.category')}</label>
                        <select
                            value={newIncident.category}
                            onChange={(e) => setNewIncident({ ...newIncident, category: e.target.value })}
                            className="w-full px-3 py-2 bg-soar-card border border-soar-border rounded-lg text-slate-900 dark:text-slate-100"
                        >
                            <option value="">{t('incidents.createModal.fields.selectCategory')}</option>
                            <option value="Malware">Malware</option>
                            <option value="Phishing">Phishing</option>
                            <option value="Data Breach">Data Breach</option>
                            <option value="Network Intrusion">Network Intrusion</option>
                            <option value="Policy Violation">Policy Violation</option>
                        </select>
                    </div>
                </form>
            </Modal>
        </>
    );
}
