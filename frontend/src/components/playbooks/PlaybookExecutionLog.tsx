'use client';

import { useEffect, useState, useCallback } from 'react';
import { DataTable, StatusBadge } from '@/components/ui';
import { playbooksApi } from '@/lib/api';
import type { Playbook, PlaybookExecution } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import { Loader2, CheckCircle, XCircle, Clock, AlertTriangle, StopCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslationStore } from '@/stores/i18nStore';

interface PlaybookExecutionLogProps {
    playbook: Playbook;
}

export default function PlaybookExecutionLog({ playbook }: PlaybookExecutionLogProps) {
    const { t } = useTranslationStore();
    const [executions, setExecutions] = useState<PlaybookExecution[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedExecution, setExpandedExecution] = useState<string | null>(null);
    const [executionDetail, setExecutionDetail] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    useEffect(() => {
        const fetchExecutions = async () => {
            try {
                setIsLoading(true);
                const res = await playbooksApi.getExecutions(playbook.id);
                setExecutions(Array.isArray(res) ? res : (res.items || []));
            } catch (error) {
                console.error('Failed to load playbook executions', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchExecutions();
    }, [playbook.id]);

    const handleToggleDetail = useCallback(async (executionId: string) => {
        if (expandedExecution === executionId) {
            setExpandedExecution(null);
            setExecutionDetail(null);
            return;
        }
        setExpandedExecution(executionId);
        setLoadingDetail(true);
        try {
            const detail = await playbooksApi.getExecutionDetail(executionId);
            setExecutionDetail(detail);
        } catch (e) {
            console.error('Failed to load execution detail', e);
        } finally {
            setLoadingDetail(false);
        }
    }, [expandedExecution]);

    const handleCancel = async (executionId: string) => {
        if (!confirm('Are you sure you want to cancel this execution?')) return;
        try {
            await playbooksApi.cancelExecution(executionId);
            // Refresh
            const res = await playbooksApi.getExecutions(playbook.id);
            setExecutions(Array.isArray(res) ? res : (res.items || []));
        } catch (e) {
            console.error('Failed to cancel execution', e);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
            case 'failed': return <XCircle className="w-4 h-4 text-rose-400" />;
            case 'running': return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
            case 'cancelled': return <StopCircle className="w-4 h-4 text-amber-400" />;
            case 'pending': return <Clock className="w-4 h-4 text-slate-400" />;
            case 'skipped': return <AlertTriangle className="w-4 h-4 text-slate-500" />;
            default: return <Clock className="w-4 h-4 text-slate-400" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'success': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
            case 'failed': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
            case 'running': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
            case 'cancelled': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
            case 'pending': return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
            default: return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 text-soar-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto w-full" dir="auto">
            {/* Statistics Header */}
            <div className="bg-soar-card rounded-lg p-4 border border-soar-border flex justify-between items-center">
                <div>
                    <h3 className="text-slate-900 dark:text-slate-200 font-medium">{playbook.name}</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        {t('playbooks.logs.mode')}: <span className={`font-mono ${(playbook as any).execution_mode === 'AUTO' ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {(playbook as any).execution_mode || 'MANUAL'}
                        </span> • {t('playbooks.logs.totalRuns')}: {playbook.execution_count || 0}
                    </p>
                </div>
                <div className="flex space-x-0 gap-4">
                    <div className="text-center">
                        <p className="text-2xl font-bold text-emerald-500">{playbook.success_count || 0}</p>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">{t('playbooks.success')}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-rose-500">{playbook.failure_count || 0}</p>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">{t('playbooks.failed')}</p>
                    </div>
                </div>
            </div>

            {/* Execution List */}
            {executions.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                    {t('playbooks.logs.noExecutions')}
                </div>
            ) : (
                <div className="space-y-2">
                    {executions.map((exec) => (
                        <div key={exec.id} className="bg-slate-50 dark:bg-soar-bg/50 rounded-lg border border-soar-border overflow-hidden">
                            {/* Execution Row */}
                            <div
                                className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-soar-bg-secondary transition-colors"
                                onClick={() => handleToggleDetail(exec.id)}
                            >
                                <div className="flex items-center space-x-0 gap-3">
                                    {expandedExecution === exec.id
                                        ? <ChevronDown className="w-4 h-4 text-slate-500" />
                                        : <ChevronRight className="w-4 h-4 text-slate-500 rtl:rotate-180" />}
                                    {getStatusIcon(exec.status)}
                                    <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{exec.id.split('-')[0]}</span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(exec.status)}`}>
                                        {exec.status.toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex items-center space-x-0 gap-4 text-xs text-slate-600 dark:text-slate-400">
                                    {exec.total_steps && (
                                        <span>{exec.completed_steps || 0}/{exec.total_steps} {t('playbooks.logs.steps')}</span>
                                    )}
                                    {exec.duration_seconds && <span>{exec.duration_seconds}s</span>}
                                    <span>{exec.started_at ? formatRelativeTime(exec.started_at) : '-'}</span>
                                    {exec.status === 'running' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleCancel(exec.id); }}
                                            className="px-2 py-1 rounded bg-rose-500/20 text-rose-500 hover:bg-rose-500/30 transition-colors"
                                        >
                                            {t('playbooks.form.cancel')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Progress Bar */}
                            {exec.total_steps && exec.total_steps > 0 && (
                                <div className="px-3 pb-1">
                                    <div className="w-full bg-soar-bg-secondary rounded-full h-1.5">
                                        <div
                                            className={`h-1.5 rounded-full transition-all duration-500 ${exec.status === 'success' ? 'bg-emerald-500' :
                                                exec.status === 'failed' ? 'bg-rose-500' :
                                                    exec.status === 'running' ? 'bg-blue-500' : 'bg-slate-500'
                                                }`}
                                            style={{ width: `${Math.round(((exec.completed_steps || 0) + (exec.failed_steps || 0)) / exec.total_steps * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Expanded Detail */}
                            {expandedExecution === exec.id && (
                                <div className="border-t border-soar-border p-3">
                                    {loadingDetail ? (
                                        <div className="flex justify-center py-4">
                                            <Loader2 className="w-5 h-5 text-soar-primary animate-spin" />
                                        </div>
                                    ) : executionDetail ? (
                                        <div className="space-y-3">
                                            {/* Steps Table */}
                                            {executionDetail.steps && executionDetail.steps.length > 0 && (
                                                <div>
                                                    <h4 className="text-xs text-slate-600 dark:text-slate-500 uppercase tracking-wider mb-2">{t('playbooks.logs.executionSteps')}</h4>
                                                    <div className="space-y-1">
                                                        {executionDetail.steps.map((step: any) => (
                                                            <div key={step.id} className="flex items-center justify-between bg-white dark:bg-soar-bg/50 rounded px-3 py-2 text-xs border border-transparent dark:border-transparent">
                                                                <div className="flex items-center space-x-0 gap-2">
                                                                    {getStatusIcon(step.status)}
                                                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{step.step_number}. {step.step_name}</span>
                                                                    <span className="text-slate-500 font-mono">[{step.action}]</span>
                                                                </div>
                                                                <div className="flex items-center space-x-0 gap-3 text-end text-right">
                                                                    {step.output_data?.output && (
                                                                        <span className="text-slate-600 dark:text-slate-400 max-w-[300px] truncate">{step.output_data.output}</span>
                                                                    )}
                                                                    {step.error_message && (
                                                                        <span className="text-rose-500 max-w-[200px] truncate">{step.error_message}</span>
                                                                    )}
                                                                    {step.duration_seconds !== null && (
                                                                        <span className="text-slate-500">{step.duration_seconds}s</span>
                                                                    )}
                                                                    {step.retry_count > 0 && (
                                                                        <span className="text-amber-500">↻{step.retry_count}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Summary */}
                                            {executionDetail.output_data && (
                                                <div className="bg-white dark:bg-soar-bg/50 rounded p-3 border border-slate-200 dark:border-transparent">
                                                    <h4 className="text-xs text-slate-600 dark:text-slate-500 uppercase tracking-wider mb-2">{t('playbooks.logs.executionSummary')}</h4>
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div>
                                                            <span className="text-slate-500">{t('playbooks.logs.duration')}:</span>
                                                            <span className="text-slate-700 dark:text-slate-300 ms-1">{executionDetail.output_data.duration_seconds}s</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500">{t('playbooks.logs.riskReduced')}:</span>
                                                            <span className={`ms-1 ${executionDetail.output_data.risk_reduced_level === 'HIGH' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                                {executionDetail.output_data.risk_reduced_level}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500">{t('playbooks.logs.stepsLbl')}:</span>
                                                            <span className="text-emerald-500 ms-1">{executionDetail.output_data.steps_succeeded} {t('playbooks.logs.passed')}</span>
                                                            {executionDetail.output_data.steps_failed > 0 && (
                                                                <span className="text-rose-500 ms-1">/ {executionDetail.output_data.steps_failed} {t('playbooks.logs.failedSteps')}</span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500">{t('playbooks.logs.rollback')}:</span>
                                                            <span className="text-slate-700 dark:text-slate-300 ms-1">{executionDetail.output_data.rollback_executed ? t('playbooks.logs.yes') : t('playbooks.logs.no')}</span>
                                                        </div>
                                                    </div>

                                                    {/* Actions Taken */}
                                                    {executionDetail.output_data.actions_taken?.length > 0 && (
                                                        <div className="mt-2 text-start">
                                                            <span className="text-slate-500 text-xs">{t('playbooks.logs.actionsTaken')}:</span>
                                                            <ul className="mt-1 space-y-0.5">
                                                                {executionDetail.output_data.actions_taken.map((a: string, i: number) => (
                                                                    <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start">
                                                                        <CheckCircle className="w-3 h-3 text-emerald-500 me-1 mt-0.5 flex-shrink-0" />
                                                                        {a}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {/* Recommendations */}
                                                    {executionDetail.output_data.recommendations?.length > 0 && (
                                                        <div className="mt-2 text-start">
                                                            <span className="text-slate-500 text-xs">{t('playbooks.logs.recommendations')}:</span>
                                                            <ul className="mt-1 space-y-0.5">
                                                                {executionDetail.output_data.recommendations.map((r: string, i: number) => (
                                                                    <li key={i} className="text-xs text-amber-600 dark:text-amber-300/80 flex items-start">
                                                                        <AlertTriangle className="w-3 h-3 text-amber-500 me-1 mt-0.5 flex-shrink-0" />
                                                                        {r}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-slate-500 text-xs">{t('playbooks.logs.noDetails')}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
