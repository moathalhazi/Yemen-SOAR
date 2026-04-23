'use client';

import { useState, useEffect } from 'react';
import { useUIStore } from '@/stores';
import { X, Brain, Loader2, Cpu, FileText, Target, Shield, Lightbulb, AlertTriangle } from 'lucide-react';
import { aiApi, alertsApi, incidentsApi } from '@/lib/api';
import type { AIAnalysis } from './AIAnalysisPanel';
import { cn } from '@/lib/utils';
import { useTranslationStore } from '@/stores/i18nStore';

export default function AIAssistantDrawer() {
    const { aiDrawer, closeAIDrawer } = useUIStore();
    const [loading, setLoading] = useState(false);
    const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { t } = useTranslationStore();

    const runAnalysis = async () => {
        if (!aiDrawer.contextId || !aiDrawer.contextType) return;

        setLoading(true);
        setError(null);
        try {
            // First fetch the raw entity data
            let rawData;
            if (aiDrawer.contextType === 'alert') {
                rawData = await alertsApi.getById(aiDrawer.contextId);
            } else {
                rawData = await incidentsApi.getById(aiDrawer.contextId);
            }

            // Send to AI for analysis
            const aiResult = await aiApi.analyze(rawData as any);
            setAnalysis(aiResult as AIAnalysis);
        } catch (err: any) {
            setError(err.message || 'Failed to analyze context. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Auto-run analysis when opened for a new context that hasn't been analyzed yet
    useEffect(() => {
        if (aiDrawer.isOpen && aiDrawer.contextId) {
            setAnalysis(null);
            setError(null);
            runAnalysis();
        }
    }, [aiDrawer.isOpen, aiDrawer.contextId]);

    const confidenceColor = (c: number) => {
        if (c >= 0.8) return 'text-green-400 bg-green-500/10 border-green-500/30';
        if (c >= 0.6) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
        return 'text-red-400 bg-red-500/10 border-red-500/30';
    };

    return (
        <>
            {/* Backdrop */}
            {aiDrawer.isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 transition-opacity backdrop-blur-sm"
                    onClick={closeAIDrawer}
                />
            )}

            <div
                className={cn(
                    "fixed top-0 end-0 h-full w-full sm:w-[500px] bg-soar-bg border-s border-soar-border z-50 transform shadow-2xl flex flex-col",
                    aiDrawer.isOpen ? "translate-x-0" : "ltr:translate-x-full rtl:-translate-x-full"
                )}
                style={{
                    visibility: aiDrawer.isOpen ? 'visible' : 'hidden',
                    transition: aiDrawer.isOpen ? 'transform 0.3s ease-in-out' : 'transform 0.3s ease-in-out, visibility 0s linear 0.3s'
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-soar-border bg-soar-card/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <Brain className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-lg text-slate-900 dark:text-white">{t('ai.assistant')}</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                                {t('ai.analyzing').replace('{type}', aiDrawer.contextType || '')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={closeAIDrawer}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading && (
                        <div className="h-full flex flex-col items-center justify-center space-y-4">
                            <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
                            <div className="text-center">
                                <p className="text-sm font-medium text-slate-900 dark:text-white">{t('ai.analyzingLlm')}</p>
                                <p className="text-xs text-slate-500 mt-1">DeepSeek-R1-Distill-Llama-8B</p>
                            </div>
                        </div>
                    )}

                    {error && !loading && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium">{t('ai.failed')}</p>
                                    <p className="text-sm opacity-80 mt-1">{error}</p>
                                </div>
                            </div>
                            <button
                                onClick={runAnalysis}
                                className="mt-4 w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm font-medium transition-colors"
                            >
                                {t('ai.tryAgain')}
                            </button>
                        </div>
                    )}

                    {analysis && !loading && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${confidenceColor(analysis.ai_confidence)}`}>
                                    {(analysis.ai_confidence * 100).toFixed(0)}% Confidence
                                </span>
                                <span className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/30 flex items-center gap-1.5">
                                    <Cpu className="w-3.5 h-3.5" />
                                    {analysis.analysis_method === 'local_llm' ? t('ai.method.local_llm') : t('ai.method.rule_based')}
                                </span>
                                {analysis.model_name && (
                                    <span className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 bg-slate-500/10 border border-slate-500/20">
                                        {analysis.model_name}
                                    </span>
                                )}
                            </div>

                            <hr className="border-soar-border" />

                            {/* Explanation */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-200">
                                    <Lightbulb className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
                                    {t('ai.explanation')}
                                </div>
                                <div className="text-sm text-slate-800 dark:text-slate-300 leading-relaxed bg-soar-card/50 p-4 rounded-xl border border-soar-border">
                                    {analysis.explanation}
                                </div>
                            </div>

                            {/* Risk Interpretation */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-200">
                                    <Shield className="w-5 h-5 text-orange-500 dark:text-orange-400" />
                                    {t('ai.riskInterpretation')}
                                </div>
                                <div className="text-sm text-slate-800 dark:text-slate-300 leading-relaxed bg-soar-card/50 p-4 rounded-xl border border-soar-border">
                                    {analysis.risk_interpretation}
                                </div>
                            </div>

                            {/* Recommended Actions */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-200">
                                    <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
                                    {t('ai.recommendedActions')}
                                </div>
                                <div className="space-y-2">
                                    {analysis.recommended_actions.map((action, i) => (
                                        <div key={i} className="flex gap-3 text-sm text-slate-800 dark:text-slate-300 bg-soar-card/50 p-3 rounded-lg border border-soar-border">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-soar-bg flex items-center justify-center text-xs font-medium text-slate-500 border border-soar-border">
                                                {i + 1}
                                            </div>
                                            <div className="pt-0.5">{action}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Incident Summary */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-200">
                                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    {t('ai.executiveSummary')}
                                </div>
                                <pre className="text-xs text-slate-200 bg-[#0f111a] rounded-xl p-4 overflow-x-auto whitespace-pre-wrap font-mono border border-soar-border/50">
                                    {analysis.incident_summary}
                                </pre>
                            </div>

                            {/* Context ID string visually hidden but accessible */}
                            <div className="text-[10px] text-slate-500 font-mono text-center pt-4">
                                {t('ai.contextId')}: {aiDrawer.contextId} <br />
                                {t('ai.evaluatedAt')}: {new Date(analysis.analyzed_at || Date.now()).toLocaleTimeString()}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {analysis && !loading && (
                    <div className="p-4 border-t border-soar-border bg-soar-card/50 flex gap-3">
                        <button
                            onClick={runAnalysis}
                            className="flex-1 px-4 py-2.5 bg-soar-bg-secondary hover:bg-soar-card border border-soar-border rounded-lg text-sm text-slate-900 dark:text-white font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Cpu className="w-4 h-4" />
                            {t('ai.reAnalyze')}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
