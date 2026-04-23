'use client';

import { useEffect } from 'react';
import { ShieldCheck, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import { Header } from '@/components/layout';
import { Button } from '@/components/ui';
import { useComplianceStore } from '@/stores';
import { complianceApi } from '@/lib/api';
import type { ComplianceFramework } from '@/types';
import { useTranslationStore } from '@/stores/i18nStore';

export default function ComplianceModule() {
    const { t } = useTranslationStore();
    const { frameworks, score, isLoading, setFrameworks, setScore, setLoading } = useComplianceStore();

    const fetchComplianceData = async () => {
        try {
            setLoading(true);
            const [frameworksData, scoreData] = await Promise.all([
                complianceApi.getFrameworks(),
                complianceApi.getScore()
            ]);
            setFrameworks(frameworksData);
            setScore(scoreData.score);
        } catch (error) {
            console.error('Failed to fetch compliance data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchComplianceData();
    }, []);

    const handleExport = async (frameworkId?: string) => {
        try {
            const blob = await complianceApi.exportReport(frameworkId);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `compliance_report_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Failed to export compliance report:', error);
            alert('Failed to generate compliance report.');
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-soar-bg">
            <Header
                title={t('compliance.title')}
                subtitle={t('compliance.subtitle')}
            />

            <div className="flex-1 overflow-auto p-4 md:p-6">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* Top Actions & Score Overview */}
                    <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                        <div className="flex items-center gap-6 bg-soar-card p-6 rounded-lg border border-soar-border w-full md:w-auto">
                            <div className="relative w-24 h-24 flex items-center justify-center rounded-full border-4 border-soar-border" style={{
                                background: `conic-gradient(${score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'} ${score}%, var(--soar-bg-secondary) 0)`
                            }}>
                                <div className="absolute inset-2 bg-soar-bg rounded-full flex items-center justify-center border border-soar-border">
                                    <span className="text-2xl font-bold text-slate-900 dark:text-white">{score}%</span>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-200">{t('compliance.posture')}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    {score >= 80 ? t('compliance.statusStrong') :
                                        score >= 60 ? t('compliance.statusModerate') :
                                            t('compliance.statusCritical')}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 w-full md:w-auto">
                            <Button variant="secondary" onClick={fetchComplianceData} isLoading={isLoading} icon={RefreshCw}>
                                {t('compliance.refreshStatus')}
                            </Button>
                            <Button variant="primary" onClick={() => handleExport()} icon={Download}>
                                {t('compliance.exportFull')}
                            </Button>
                        </div>
                    </div>

                    {/* Frameworks List */}
                    <div className="grid gap-6">
                        {frameworks.map((fw: ComplianceFramework) => (
                            <div key={fw.id} className="bg-soar-card border border-soar-border rounded-lg overflow-hidden shrink-0">
                                <div className="p-4 border-b border-soar-border flex justify-between items-center bg-soar-bg-secondary/50">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="w-5 h-5 text-soar-accent" />
                                            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200">{fw.name} <span className="text-slate-500 dark:text-slate-400 text-sm ms-2">v{fw.version}</span></h3>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{fw.description}</p>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-end">
                                            <p className="text-2xl font-bold text-slate-900 dark:text-slate-200">{fw.score_percentage}%</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('compliance.complianceLbl')}</p>
                                        </div>
                                        <Button variant="secondary" onClick={() => handleExport(fw.id)} title={t('compliance.exportFramework')} icon={Download}>
                                        </Button>
                                    </div>
                                </div>
                                <div className="p-0 overflow-x-auto">
                                    <table className="w-full text-sm text-start">
                                        <thead className="text-xs text-slate-500 dark:text-slate-400 bg-soar-bg-secondary/80 uppercase">
                                            <tr>
                                                <th className="px-6 py-3 font-medium text-start">{t('compliance.table.controlId')}</th>
                                                <th className="px-6 py-3 font-medium text-start">{t('compliance.table.title')}</th>
                                                <th className="px-6 py-3 font-medium text-start">{t('compliance.table.status')}</th>
                                                <th className="px-6 py-3 font-medium text-start">{t('compliance.table.evidence')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-soar-border/50">
                                            {fw.controls.map(control => (
                                                <tr key={control.id} className="hover:bg-soar-accent/5 transition-colors">
                                                    <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300 w-32">{control.control_id}</td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-slate-900 dark:text-slate-200 font-medium">{control.title}</p>
                                                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 max-w-md truncate">{control.description}</p>
                                                    </td>
                                                    <td className="px-6 py-4 w-40">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${control.status === 'compliant' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                            control.status === 'non_compliant' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' :
                                                                'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20'
                                                            }`}>
                                                            {control.status === 'compliant' ? t('compliance.status.compliant') :
                                                                control.status === 'non_compliant' ? t('compliance.status.nonCompliant') :
                                                                    t('compliance.status.unknown')}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 w-40">
                                                        {control.evidence_provided ? (
                                                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-xs font-medium">
                                                                <ShieldCheck className="w-4 h-4" /> {t('compliance.evidence.provided')}
                                                            </span>
                                                        ) : control.evidence_required ? (
                                                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 text-xs font-medium">
                                                                <AlertTriangle className="w-4 h-4" /> {t('compliance.evidence.missing')}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-500 text-xs">{t('compliance.evidence.na')}</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {fw.controls.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                                                        {t('compliance.noControls')}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}

                        {frameworks.length === 0 && !isLoading && (
                            <div className="bg-soar-card border border-soar-border rounded-lg p-12 text-center">
                                <ShieldCheck className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-300">{t('compliance.noFrameworks')}</h3>
                                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-2">{t('compliance.noFrameworksDesc')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
