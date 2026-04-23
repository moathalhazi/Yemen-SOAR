'use client';

import { useState } from 'react';
import {
    FileText, HardDrive, Network, Shield, CheckCircle,
    XCircle, Clock, Copy, Check, Loader2
} from 'lucide-react';
import { useTranslationStore } from '@/stores/i18nStore';

interface EvidenceFile {
    filename: string;
    sha256: string;
    size_bytes: number;
    status?: 'VERIFIED' | 'TAMPERED' | 'MISSING' | 'PENDING';
}

interface ForensicEvidenceCardProps {
    files: EvidenceFile[];
    incidentId: string;
    chainHash?: string;
    collectedAt?: string;
    collectedBy?: string;
    overallIntegrity?: string;
    onVerify?: () => void;
    verifying?: boolean;
    className?: string;
}

const FILE_ICONS: Record<string, typeof FileText> = {
    'system_info.json': HardDrive,
    'processes.json': FileText,
    'network_connections.json': Network,
    'alert_logs.json': Shield,
};

function IntegrityBadge({ status }: { status?: string }) {
    const { t } = useTranslationStore();
    switch (status) {
        case 'VERIFIED':
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/30">
                    <CheckCircle className="w-3 h-3" /> {t('forensic.status.verified')}
                </span>
            );
        case 'TAMPERED':
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30 animate-pulse">
                    <XCircle className="w-3 h-3" /> {t('forensic.status.tampered')}
                </span>
            );
        case 'MISSING':
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
                    <XCircle className="w-3 h-3" /> {t('forensic.status.missing')}
                </span>
            );
        default:
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/30">
                    <Clock className="w-3 h-3" /> {t('forensic.status.pending')}
                </span>
            );
    }
}

function CopyHash({ hash }: { hash: string }) {
    const { t } = useTranslationStore();
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(hash);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 text-xs font-mono text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            title={t('forensic.copyHash')}
        >
            {hash.slice(0, 16)}…
            {copied ? (
                <Check className="w-3 h-3 text-green-400" />
            ) : (
                <Copy className="w-3 h-3" />
            )}
        </button>
    );
}

export default function ForensicEvidenceCard({
    files,
    incidentId,
    chainHash,
    collectedAt,
    collectedBy,
    overallIntegrity,
    onVerify,
    verifying = false,
    className = '',
}: ForensicEvidenceCardProps) {
    const { t } = useTranslationStore();
    return (
        <div className={`bg-soar-bg-secondary rounded-xl border border-soar-border ${className}`} dir="auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-soar-border">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-200">{t('forensic.title')}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {files.length} {t('forensic.filesCollected')}
                            {collectedAt && ` • ${new Date(collectedAt).toLocaleString()}`}
                        </p>
                    </div>
                </div>

                {onVerify && (
                    <button
                        onClick={onVerify}
                        disabled={verifying}
                        className="btn btn-primary text-xs px-3 py-1.5"
                    >
                        {verifying ? (
                            <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {t('forensic.actions.verifying')}
                            </>
                        ) : (
                            <>
                                <Shield className="w-3 h-3" />
                                {t('forensic.actions.verify')}
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Overall status */}
            {overallIntegrity && (
                <div className={`mx-4 mt-3 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 ${overallIntegrity.includes('INTACT') || overallIntegrity.includes('سليمة')
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                    {overallIntegrity.includes('INTACT') ? (
                        <CheckCircle className="w-4 h-4" />
                    ) : (
                        <XCircle className="w-4 h-4" />
                    )}
                    {overallIntegrity}
                </div>
            )}

            {/* Evidence files list */}
            <div className="p-4 space-y-2">
                {files.map((file) => {
                    const Icon = FILE_ICONS[file.filename] || FileText;
                    return (
                        <div
                            key={file.filename}
                            className="flex items-center justify-between p-3 bg-soar-bg rounded-lg border border-soar-border/50"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate">{file.filename}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <CopyHash hash={file.sha256} />
                                        <span className="text-xs text-slate-500">
                                            {(file.size_bytes / 1024).toFixed(1)} KB
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <IntegrityBadge status={file.status} />
                        </div>
                    );
                })}
            </div>

            {/* Chain Hash footer */}
            {chainHash && (
                <div className="px-4 pb-4">
                    <div className="flex items-center justify-between p-2 bg-soar-bg rounded-lg border border-soar-border/30">
                        <span className="text-xs text-slate-500 dark:text-slate-400">{t('forensic.chainHash')}</span>
                        <CopyHash hash={chainHash} />
                    </div>
                </div>
            )}
        </div>
    );
}

export { IntegrityBadge, CopyHash };
export type { EvidenceFile };
