'use client';

import { useState } from 'react';
import {
    Brain, ChevronDown, ChevronUp, Shield, Target,
    Lightbulb, FileText, Loader2, Cpu
} from 'lucide-react';
import { useTranslationStore } from '@/stores/i18nStore';

interface AIAnalysis {
    explanation: string;
    risk_interpretation: string;
    recommended_actions: string[];
    incident_summary: string;
    mitre_explanation?: string | null;
    ai_confidence: number;
    analysis_method: string;
    model_name?: string;
    analyzed_at: string;
}

interface AIAnalysisPanelProps {
    analysis?: AIAnalysis | null;
    loading?: boolean;
    onAnalyze?: () => void;
    className?: string;
}

export default function AIAnalysisPanel({
    analysis,
    loading = false,
    onAnalyze,
    className = '',
}: AIAnalysisPanelProps) {
    const [expanded, setExpanded] = useState(true);
    const [showSummary, setShowSummary] = useState(false);
    const { t } = useTranslationStore();

    const confidenceColor = (c: number) => {
        if (c >= 0.8) return 'text-green-400 bg-green-500/10 border-green-500/30';
        if (c >= 0.6) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
        return 'text-red-400 bg-red-500/10 border-red-500/30';
    };

    return (
        <div className={`bg-soar-bg-secondary rounded-xl border border-soar-border overflow-hidden ${className}`}>
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-soar-card/30 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Brain className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="text-start">
                        <h3 className="font-semibold text-sm">{t('ai.title')}</h3>
                        <p className="text-xs text-slate-400">
                            {analysis
                                ? `${analysis.analysis_method === 'local_llm' ? t('ai.method.local_llm') : t('ai.method.rule_based')} • ${(analysis.ai_confidence * 100).toFixed(0)}% ${t('ai.confidence')}`
                                : t('ai.notAnalyzed')}
                        </p>
                    </div>
                </div>
                {expanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
            </button>

            {/* Expanded content */}
            {expanded && (
                <div className="px-4 pb-4 space-y-4 animate-fade-in">
                    {/* No analysis yet */}
                    {!analysis && !loading && (
                        <div className="text-center py-6">
                            <Brain className="w-12 h-12 mx-auto mb-3 text-slate-500 opacity-50" />
                            <p className="text-slate-400 text-sm mb-4">
                                {t('ai.noAnalysis')}
                            </p>
                            {onAnalyze && (
                                <button
                                    onClick={onAnalyze}
                                    className="btn btn-primary text-sm bg-soar-accent hover:bg-soar-accent/90"
                                >
                                    <Cpu className="w-4 h-4" />
                                    {t('ai.runAnalysis')}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div className="text-center py-8">
                            <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-purple-400" />
                            <p className="text-slate-400 text-sm">{t('ai.analyzingLlm')}</p>
                            <p className="text-slate-500 text-xs mt-1">DeepSeek-R1-Distill-Llama-8B</p>
                        </div>
                    )}

                    {/* Analysis results */}
                    {analysis && !loading && (
                        <>
                            {/* Confidence + Method badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2 py-1 rounded-md text-xs font-medium border ${confidenceColor(analysis.ai_confidence)}`}>
                                    {(analysis.ai_confidence * 100).toFixed(0)}% Confidence
                                </span>
                                <span className="px-2 py-1 rounded-md text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/30">
                                    <Cpu className="w-3 h-3 inline me-1" />
                                    {analysis.analysis_method === 'local_llm' ? t('ai.method.local_llm') : t('ai.method.rule_based')}
                                </span>
                                {analysis.model_name && (
                                    <span className="px-2 py-1 rounded-md text-xs text-slate-400 bg-slate-500/10 border border-slate-500/20">
                                        {analysis.model_name}
                                    </span>
                                )}
                            </div>

                            {/* Explanation */}
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                                    {t('ai.explanation')}
                                </div>
                                <p className="text-sm text-slate-300 leading-relaxed ps-6 bg-soar-card/50 p-3 rounded-lg border border-soar-border">
                                    {analysis.explanation}
                                </p>
                            </div>

                            {/* Risk Interpretation */}
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                    <Shield className="w-4 h-4 text-orange-400" />
                                    {t('ai.riskInterpretation')}
                                </div>
                                <p className="text-sm text-slate-300 leading-relaxed ps-6 bg-soar-card/50 p-3 rounded-lg border border-soar-border">
                                    {analysis.risk_interpretation}
                                </p>
                            </div>

                            {/* Recommended Actions */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                    <Target className="w-4 h-4 text-green-400" />
                                    {t('ai.recommendedActions')}
                                </div>
                                <ul className="space-y-1.5 ps-6">
                                    {analysis.recommended_actions.map((action, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300 bg-soar-card/50 px-3 py-2 rounded border border-soar-border">
                                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-soar-bg flex items-center justify-center text-xs font-medium text-slate-300 mt-0.5 border border-soar-border">
                                                {i + 1}
                                            </span>
                                            <span className="pt-0.5">{action}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Incident Summary (collapsible) */}
                            <div className="space-y-1">
                                <button
                                    onClick={() => setShowSummary(!showSummary)}
                                    className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                                >
                                    <FileText className="w-4 h-4 text-blue-400" />
                                    {t('ai.incidentSummary')}
                                    {showSummary ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                                {showSummary && (
                                    <pre className="text-xs text-slate-400 bg-soar-bg rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono ms-6 border border-soar-border font-medium">
                                        {analysis.incident_summary}
                                    </pre>
                                )}
                            </div>

                            {/* Re-analyze button */}
                            {onAnalyze && (
                                <div className="pt-2 border-t border-soar-border">
                                    <button
                                        onClick={onAnalyze}
                                        className="text-xs text-slate-400 hover:text-purple-400 transition-colors flex items-center gap-1 font-medium bg-soar-bg-secondary px-3 py-1.5 rounded border border-soar-border"
                                    >
                                        <Cpu className="w-3 h-3" />
                                        {t('ai.reAnalyze')}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export type { AIAnalysis };
