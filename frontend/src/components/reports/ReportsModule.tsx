'use client';

import { useEffect, useState } from 'react';
import { FileText, Download, Plus, Eye, Loader2, Trash2, BarChart2, CalendarClock, History } from 'lucide-react';
import { Header } from '@/components/layout';
import { Button, DataTable, Modal } from '@/components/ui';
import { useReportsStore } from '@/stores';
import { reportsApi, aiApi } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useTranslationStore } from '@/stores/i18nStore';
import type { Report } from '@/types';

import { ReportAnalytics } from './ReportAnalytics';
import { ReportBuilder } from './ReportBuilder';
import { ReportScheduler } from './ReportScheduler';

export default function ReportsModule() {
    const { t } = useTranslationStore();
    const { reports, setReports, isLoading, setLoading } = useReportsStore();
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [targetIncidentId, setTargetIncidentId] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    type TabType = 'analytics' | 'generate' | 'schedule' | 'history';
    const [activeTab, setActiveTab] = useState<TabType>('analytics');

    const fetchReports = async () => {
        try {
            setLoading(true);
            const response = await reportsApi.getAll();
            const items = Array.isArray(response) ? response : (response.items || []);
            setReports(items);
        } catch (error) {
            console.error('Failed to fetch reports:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetIncidentId.trim()) return;

        try {
            setIsGenerating(true);
            await aiApi.generateReport(targetIncidentId, true);
            setIsGenerateModalOpen(false);
            setTargetIncidentId('');
            alert(t('reports.notifications.queued'));
            setTimeout(fetchReports, 3000); // refresh after a delay to show new report
        } catch (error) {
            console.error('Failed to generate report:', error);
            alert(t('reports.notifications.failed'));
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = async (id: string, name: string) => {
        try {
            const blob = await reportsApi.download(id);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${name.replace(/\s+/g, '_')}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Failed to download report:', error);
            alert(t('reports.notifications.downloadFailed'));
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('reports.notifications.confirmDelete'))) return;
        try {
            await reportsApi.delete(id);
            fetchReports();
        } catch (error) {
            console.error('Failed to delete report', error);
        }
    };

    const columns = [
        {
            key: 'name',
            header: t('reports.table.name'),
            render: (r: Report) => (
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                    <FileText className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                    <span className="font-medium text-slate-900 dark:text-slate-200">{r.name}</span>
                </div>
            )
        },
        {
            key: 'status',
            header: t('reports.table.status'),
            render: (r: Report) => {
                const colors = {
                    completed: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
                    generating: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
                    failed: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
                    pending: 'text-blue-400 bg-blue-400/10 border-blue-400/20'
                };
                const colorClass = colors[r.status] || colors.pending;
                return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
                        {r.status === 'generating' && <Loader2 className="w-3 h-3 me-1 animate-spin" />}
                        {r.status === 'completed' ? t('reports.status.completed') :
                            r.status === 'generating' ? t('reports.status.generating') :
                                r.status === 'failed' ? t('reports.status.failed') :
                                    t('reports.status.pending')}
                    </span>
                );
            }
        },
        {
            key: 'format',
            header: t('reports.table.format'),
            render: (r: Report) => <span className="uppercase text-xs font-mono text-slate-500 dark:text-slate-400 bg-soar-bg px-2 py-1 rounded border border-soar-border">{r.format}</span>
        },
        {
            key: 'size',
            header: t('reports.table.size'),
            render: (r: Report) => r.file_size ? `${(r.file_size / 1024).toFixed(1)} KB` : '-'
        },
        {
            key: 'generated',
            header: t('reports.table.generated'),
            render: (r: Report) => r.generated_at ? formatRelativeTime(r.generated_at) : '-'
        },
        {
            key: 'actions',
            header: t('reports.table.actions'),
            render: (r: Report) => (
                <div className="flex space-x-2 rtl:space-x-reverse">
                    <PermissionGuard permissions="reports.export">
                        <button
                            onClick={() => handleDownload(r.id, r.name)}
                            disabled={r.status !== 'completed'}
                            className={`p-1.5 rounded transition-colors ${r.status !== 'completed' ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:text-soar-primary hover:bg-slate-700/50'}`}
                            title="Download PDF"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    </PermissionGuard>
                    <PermissionGuard permissions="reports.generate">
                        <button
                            onClick={() => handleDelete(r.id)}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-700/50 rounded transition-colors"
                            title="Delete Report"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </PermissionGuard>
                </div>
            )
        }
    ];

    return (
        <div className="flex flex-col h-full overflow-hidden bg-soar-bg">
            <Header
                title={t('reports.title')}
                subtitle={t('reports.subtitle')}
            />

            <div className="flex-1 overflow-auto p-4 md:p-6">
                <div className="max-w-7xl mx-auto space-y-6">

                    <div className="flex space-x-1 rtl:space-x-reverse bg-soar-card/50 p-1 rounded-lg border border-soar-border overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('analytics')}
                            className={`flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 rounded-md transition-colors whitespace-nowrap ${activeTab === 'analytics'
                                    ? 'bg-soar-primary text-white shadow'
                                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                        >
                            <BarChart2 className="w-4 h-4" />
                            <span>Dashboard & Analytics</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('generate')}
                            className={`flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 rounded-md transition-colors whitespace-nowrap ${activeTab === 'generate'
                                    ? 'bg-soar-primary text-white shadow'
                                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                        >
                            <Plus className="w-4 h-4" />
                            <span>Custom Builder</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('schedule')}
                            className={`flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 rounded-md transition-colors whitespace-nowrap ${activeTab === 'schedule'
                                    ? 'bg-soar-primary text-white shadow'
                                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                        >
                            <CalendarClock className="w-4 h-4" />
                            <span>Scheduled Reports</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 rounded-md transition-colors whitespace-nowrap ${activeTab === 'history'
                                    ? 'bg-soar-primary text-white shadow'
                                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                        >
                            <History className="w-4 h-4" />
                            <span>History & Export</span>
                        </button>
                    </div>

                    <div className="mt-6">
                        {activeTab === 'analytics' && <ReportAnalytics />}
                        {activeTab === 'generate' && <ReportBuilder onGenerated={() => { setActiveTab('history'); fetchReports(); }} />}
                        {activeTab === 'schedule' && <ReportScheduler />}
                        {activeTab === 'history' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">Generated Reports</h3>
                                    <PermissionGuard permissions="reports.generate">
                                        <Button
                                            variant="secondary"
                                            onClick={() => setIsGenerateModalOpen(true)}
                                            icon={Plus}
                                        >
                                            Quick AI Report
                                        </Button>
                                    </PermissionGuard>
                                </div>
                                <div className="bg-soar-card backdrop-blur-sm border border-soar-border rounded-lg overflow-hidden shrink-0">
                                    <DataTable
                                        columns={columns}
                                        data={reports}
                                        keyExtractor={(r) => r.id}
                                        isLoading={isLoading}
                                        emptyMessage={t('reports.emptyMessage')}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Modal
                isOpen={isGenerateModalOpen}
                onClose={() => setIsGenerateModalOpen(false)}
                title={t('reports.modal.title')}
                size="md"
            >
                <form onSubmit={handleGenerate} className="space-y-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t('reports.modal.description')}
                    </p>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('reports.modal.incidentId')}</label>
                        <input
                            type="text"
                            required
                            value={targetIncidentId}
                            onChange={(e) => setTargetIncidentId(e.target.value)}
                            placeholder={t('reports.modal.placeholder')}
                            className="w-full bg-soar-bg border border-soar-border rounded p-2 text-slate-900 dark:text-white"
                        />
                    </div>

                    <div className="flex justify-end space-x-3 rtl:space-x-reverse pt-4 border-t border-soar-border">
                        <Button variant="secondary" onClick={() => setIsGenerateModalOpen(false)} type="button" disabled={isGenerating}>
                            {t('reports.modal.cancel')}
                        </Button>
                        <Button variant="primary" type="submit" isLoading={isGenerating} disabled={!targetIncidentId.trim()}>
                            {t('reports.modal.submit')}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
