'use client';

import { useState, useEffect } from 'react';
import { FileText, Download, Trash2, Clock, User, Loader2, Calendar, Filter, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { reportsApi } from '@/lib/api';
import { useLocale } from '@/contexts/LocaleContext';
import { useUIStore } from '@/stores';
import { useTranslationStore } from '@/stores/i18nStore';
import ReportViewer from './ReportViewer';
import type { Report, ReportFormat } from '@/types';

interface ReportsSectionProps {
    className?: string;
    limit?: number;
    showHeader?: boolean;
}

const formatIcons: Record<ReportFormat, React.ElementType> = {
    pdf: FileText,
    html: FileText,
    docx: FileText,
    csv: FileText,
};

const formatColors: Record<ReportFormat, string> = {
    pdf: 'text-red-400',
    html: 'text-blue-400',
    docx: 'text-blue-500',
    csv: 'text-green-400',
};

export default function ReportsSection({ className, limit = 5, showHeader = true }: ReportsSectionProps) {
    const { formatDate } = useLocale();
    const { t } = useTranslationStore();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all'>('30d');

    // Viewer State
    const [viewReport, setViewReport] = useState<Report | null>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [viewLoading, setViewLoading] = useState(false);

    useEffect(() => {
        fetchReports();
    }, [dateRange]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const dateFrom = dateRange === 'all'
                ? undefined
                : new Date(Date.now() - (dateRange === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000).toISOString();

            const response = await reportsApi.getAll({
                page_size: limit,
                date_from: dateFrom
            });
            setReports(response.items || []);
        } catch (error) {
            console.error('Failed to fetch reports:', error);
            setReports([]);
        } finally {
            setLoading(false);
        }
    };

    const handleView = async (reportId: string) => {
        setViewLoading(true);
        try {
            // Fetch full details including data snapshot
            const fullReport = await reportsApi.getById(reportId);
            setViewReport(fullReport);
            setIsViewerOpen(true);
        } catch (error) {
            console.error('Failed to load report details:', error);
            alert('Failed to load report details');
        } finally {
            setViewLoading(false);
        }
    };

    const handleDownload = async (report: Report) => {
        try {
            const blob = await reportsApi.download(report.id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${report.name}.${report.format}`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) return;
        try {
            await reportsApi.delete(id);
            setReports(reports.filter(r => r.id !== id));
        } catch (error) {
            console.error('Delete failed:', error);
        }
    };

    return (
        <div className={cn('bg-soar-card rounded-xl border border-soar-border', className)}>
            {showHeader && (
                <div className="flex items-center justify-between p-4 border-b border-soar-border">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-soar-accent" />
                        <h3 className="font-semibold text-slate-900 dark:text-white">{t('dashboard.recentReports')}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | 'all')}
                            className="bg-soar-bg border border-soar-border rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-soar-accent"
                        >
                            <option value="7d">{t('dashboard.last7Days')}</option>
                            <option value="30d">{t('dashboard.last30Days')}</option>
                            <option value="all">{t('dashboard.allTime') || 'All time'}</option>
                        </select>
                    </div>
                </div>
            )}

            <div className="p-4">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-soar-accent" />
                    </div>
                ) : reports.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>{t('dashboard.noReportsYet') || 'No reports generated yet'}</p>
                        <p className="text-sm text-slate-500 mt-1">{t('dashboard.useGenerateButton') || 'Use the "Generate Report" button to create one'}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {reports.map((report) => {
                            const FormatIcon = formatIcons[report.format];
                            return (
                                <div
                                    key={report.id}
                                    className="flex items-center justify-between p-3 bg-soar-bg rounded-lg hover:bg-soar-bg/80 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            'w-10 h-10 rounded-lg flex items-center justify-center',
                                            'bg-soar-card border border-soar-border'
                                        )}>
                                            <FormatIcon className={cn('w-5 h-5', formatColors[report.format])} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900 dark:text-white">{report.name}</p>
                                            <div className="flex items-center gap-3 text-xs text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDate(report.generated_at, {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                                <span className="uppercase font-medium text-soar-accent/80 border border-soar-accent/20 px-1.5 rounded text-[10px]">
                                                    {report.format}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleView(report.id)}
                                            disabled={viewLoading}
                                            className="p-2 text-slate-400 hover:text-soar-accent hover:bg-soar-card rounded-lg transition-colors"
                                            title={t('dashboard.viewDetails') || 'View Details'}
                                        >
                                            {viewLoading && viewReport?.id === report.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => handleDownload(report)}
                                            className="p-2 text-slate-400 hover:text-blue-400 hover:bg-soar-card rounded-lg transition-colors"
                                            title={t('dashboard.download') || 'Download'}
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(report.id)}
                                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-soar-card rounded-lg transition-colors"
                                            title={t('dashboard.delete') || 'Delete'}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {reports.length > 0 && (
                <div className="p-4 border-t border-soar-border">
                    <button
                        onClick={() => useUIStore.getState().setActiveModule('reports')}
                        className="text-sm text-soar-accent hover:underline w-full text-start"
                    >
                        {t('dashboard.viewAllReports') || 'View all reports \u2192'}
                    </button>
                </div>
            )}

            {/* Report Viewer Modal */}
            <ReportViewer
                isOpen={isViewerOpen}
                onClose={() => setIsViewerOpen(false)}
                report={viewReport}
            />
        </div>
    );
}
