'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Search, Shield, CheckCircle, XCircle, Clock, Loader2,
    AlertTriangle, RefreshCw, FileText, HardDrive, Network,
    Database, Copy, Check, Link2, Hash, User, ArrowDown
} from 'lucide-react';
import { Header } from '@/components/layout';
import { Button } from '@/components/ui';
import { formatRelativeTime } from '@/lib/utils';
import { evidenceApi, forensicApi } from '@/lib/api';
import type { Evidence } from '@/types';
import { useTranslationStore } from '@/stores/i18nStore';

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    memory_dump: HardDrive,
    disk_image: Database,
    network_capture: Network,
    logs: FileText,
    file: FileText,
    system_info: HardDrive,
    processes: FileText,
    network_connections: Network,
    alert_logs: Shield,
};

// Integrity Badge component
function IntegrityBadge({ status }: { status: string }) {
    const { t } = useTranslationStore();
    switch (status) {
        case 'VERIFIED':
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30">
                    <CheckCircle className="w-3.5 h-3.5" /> {t('forensic.status.verified')}
                </span>
            );
        case 'TAMPERED':
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 animate-pulse">
                    <XCircle className="w-3.5 h-3.5" /> {t('forensic.status.tampered')}
                </span>
            );
        case 'MISSING':
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30">
                    <AlertTriangle className="w-3.5 h-3.5" /> {t('forensic.status.missing')}
                </span>
            );
        default:
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/30">
                    <Clock className="w-3.5 h-3.5" /> {t('forensic.status.pending')}
                </span>
            );
    }
}

// Copy hash component
function CopyHash({ hash }: { hash: string }) {
    const [copied, setCopied] = useState(false);
    const { t } = useTranslationStore();
    const handleCopy = () => {
        navigator.clipboard.writeText(hash);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 font-mono text-xs text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            title={t('forensic.copyHash')}
        >
            {hash.slice(0, 20)}…
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        </button>
    );
}

// Evidence file from forensic service
interface ForensicFile {
    filename: string;
    sha256: string;
    size_bytes: number;
    status: string;
}

// Chain link from forensic service
interface ChainLink {
    file: string;
    sha256: string;
    previous_hash: string;
}

export default function ForensicModule() {
    const { t } = useTranslationStore();
    const [evidence, setEvidence] = useState<Evidence[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Forensic state for a selected incident
    const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
    const [forensicFiles, setForensicFiles] = useState<ForensicFile[]>([]);
    const [chainLinks, setChainLinks] = useState<ChainLink[]>([]);
    const [verifying, setVerifying] = useState(false);
    const [overallIntegrity, setOverallIntegrity] = useState<string>('');
    const [forensicMeta, setForensicMeta] = useState<any>(null);

    // Fetch evidence list
    const fetchEvidence = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await evidenceApi.getAll({ page: 1, page_size: 50 });
            setEvidence(response.items || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load evidence');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEvidence();
    }, [fetchEvidence]);

    // Fetch forensic details for a specific incident
    const fetchForensicDetails = async (incidentId: string) => {
        setSelectedIncidentId(incidentId);
        setForensicFiles([]);
        setChainLinks([]);
        setOverallIntegrity('');
        setForensicMeta(null);

        try {
            const data: any = await forensicApi.getEvidence(incidentId);
            if (data?.files) {
                setForensicFiles(data.files.map((f: any) => ({
                    filename: f.filename || f.file,
                    sha256: f.sha256 || f.hash || '',
                    size_bytes: f.size_bytes || 0,
                    status: 'PENDING',
                })));
            }
            if (data?.chain) {
                setChainLinks(data.chain);
            }
            setForensicMeta(data?.metadata || null);
        } catch {
            // Evidence not yet collected
        }
    };

    // Verify integrity
    const verifyIntegrity = async () => {
        if (!selectedIncidentId) return;
        setVerifying(true);
        try {
            const result: any = await forensicApi.verify(selectedIncidentId);
            if (result?.files) {
                setForensicFiles(prev => prev.map(f => {
                    const verified = result.files.find((vf: any) =>
                        vf.filename === f.filename || vf.file === f.filename
                    );
                    return {
                        ...f,
                        status: verified?.valid ? 'VERIFIED' : 'TAMPERED',
                    };
                }));
            }
            setOverallIntegrity(
                result?.chain_valid
                    ? t('forensic.chainIntact')
                    : t('forensic.chainBroken')
            );
        } catch {
            setOverallIntegrity(t('forensic.verifyFailed'));
        } finally {
            setVerifying(false);
        }
    };

    // Filter evidence by search
    const filteredEvidence = evidence.filter(e =>
        !searchQuery ||
        (e as any).filename?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e as any).incident_id?.includes(searchQuery) ||
        (e as any).hash?.includes(searchQuery)
    );

    return (
        <>
            <Header
                title={t('forensic.title')}
                subtitle={t('forensic.subtitle')}
                actions={
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            icon={isLoading ? Loader2 : RefreshCw}
                            onClick={fetchEvidence}
                            disabled={isLoading}
                        >
                            {isLoading ? t('forensic.actions.loading') : t('forensic.actions.refresh')}
                        </Button>
                    </div>
                }
            />

            <div className="space-y-6 mt-16 pb-8">
                {/* Error Banner */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
                        <p className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            {error}
                        </p>
                    </div>
                )}

                {/* Search */}
                <div className="relative">
                    <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder={t('forensic.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full ps-10 pe-4 py-2.5 bg-soar-card border border-soar-border rounded-lg text-sm text-slate-900 dark:text-slate-100"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* ═══ Left: Evidence List (2/3) ═══ */}
                    <div className="lg:col-span-2 space-y-3">
                        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-500" />
                            {t('forensic.evidenceFiles')}
                            <span className="text-xs text-slate-500">({filteredEvidence.length})</span>
                        </h3>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-8 h-8 animate-spin text-soar-accent" />
                            </div>
                        ) : filteredEvidence.length === 0 ? (
                            <div className="card text-center py-12 bg-soar-card border-soar-border">
                                <Shield className="w-12 h-12 mx-auto mb-3 text-slate-400 opacity-50" />
                                <p className="text-slate-600 dark:text-slate-400">{t('forensic.noEvidence')}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {t('forensic.noEvidenceDesc')}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredEvidence.map((ev) => {
                                    const e = ev as any;
                                    const Icon = typeIcons[e.type] || FileText;
                                    const isSelected = e.incident_id === selectedIncidentId;

                                    return (
                                        <div
                                            key={e.id}
                                            onClick={() => e.incident_id && fetchForensicDetails(e.incident_id)}
                                            className={`flex items-center justify-between p-4 bg-soar-bg-secondary rounded-xl border transition-all cursor-pointer ${isSelected
                                                ? 'border-cyan-500/50 bg-cyan-500/5'
                                                : 'border-soar-border hover:border-soar-accent/30'
                                                }`}
                                            dir="auto"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-lg bg-soar-card flex items-center justify-center flex-shrink-0">
                                                    <Icon className="w-5 h-5 text-slate-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                                                        {e.filename || e.name || `${t('navigation.evidence')} ${e.id?.slice(0, 8)}`}
                                                    </p>
                                                    <div className="flex items-center gap-3 mt-0.5">
                                                        {e.hash && (
                                                            <span className="text-xs font-mono text-slate-500 truncate max-w-[200px]">
                                                                SHA256: {e.hash.slice(0, 16)}…
                                                            </span>
                                                        )}
                                                        {e.size && (
                                                            <span className="text-xs text-slate-500">
                                                                {(e.size / 1024).toFixed(1)} KB
                                                            </span>
                                                        )}
                                                        {e.collected_at && (
                                                            <span className="text-xs text-slate-500">
                                                                {formatRelativeTime(e.collected_at)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {e.integrity_status && (
                                                    <IntegrityBadge status={e.integrity_status} />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ═══ Right: Forensic Detail Panel (1/3) ═══ */}
                    <div className="space-y-4">
                        {/* Verify Integrity */}
                        <div className="card bg-soar-card border-soar-border">
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-900 dark:text-slate-200">
                                <Shield className="w-4 h-4 text-cyan-500" />
                                {t('forensic.integrityTitle')}
                            </h3>

                            {selectedIncidentId ? (
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {t('forensic.incidentLabel')} <span className="text-cyan-600 dark:text-cyan-400 font-mono">{selectedIncidentId.slice(0, 12)}…</span>
                                    </p>

                                    <button
                                        onClick={verifyIntegrity}
                                        disabled={verifying}
                                        className="w-full btn btn-primary text-sm justify-center"
                                    >
                                        {verifying ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                {t('forensic.actions.verifying')}
                                            </>
                                        ) : (
                                            <>
                                                <Shield className="w-4 h-4" />
                                                {t('forensic.actions.verify')}
                                            </>
                                        )}
                                    </button>

                                    {/* Overall result */}
                                    {overallIntegrity && (
                                        <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${overallIntegrity.includes('INTACT') || overallIntegrity.includes('سليمة')
                                            ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                                            : overallIntegrity.includes('BROKEN') || overallIntegrity.includes('مكسورة')
                                                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                                : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20'
                                            }`}>
                                            {overallIntegrity.includes('INTACT') || overallIntegrity.includes('سليمة') ? (
                                                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                            ) : (
                                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                            )}
                                            <span>{overallIntegrity}</span>
                                        </div>
                                    )}

                                    {/* File-level results */}
                                    {forensicFiles.length > 0 && (
                                        <div className="space-y-2 pt-2">
                                            {forensicFiles.map((f) => (
                                                <div key={f.filename} className="flex items-center justify-between p-2 bg-soar-bg rounded-lg text-xs">
                                                    <span className="text-slate-300 truncate">{f.filename}</span>
                                                    <IntegrityBadge status={f.status} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
                                    {t('forensic.selectToVerify')}
                                </p>
                            )}
                        </div>

                        {/* Chain of Custody */}
                        <div className="card bg-soar-card border-soar-border">
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-900 dark:text-slate-200">
                                <Link2 className="w-4 h-4 text-cyan-500" />
                                {t('forensic.chainOfCustody')}
                            </h3>

                            {chainLinks.length > 0 ? (
                                <div className="space-y-0">
                                    {/* Genesis */}
                                    <div className="flex items-start gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className="w-7 h-7 rounded-full bg-slate-700 border-2 border-slate-500 flex items-center justify-center">
                                                <Hash className="w-3 h-3 text-slate-400" />
                                            </div>
                                            <div className="w-0.5 h-5 bg-slate-600" />
                                        </div>
                                        <div className="pt-0.5">
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('forensic.genesis')}</p>
                                            <p className="text-xs font-mono text-slate-500">{'0'.repeat(16)}…</p>
                                        </div>
                                    </div>

                                    {chainLinks.map((link, i) => (
                                        <div key={link.file} className="flex items-start gap-3">
                                            <div className="flex flex-col items-center">
                                                <div className="w-7 h-7 rounded-full bg-cyan-500/10 border-2 border-cyan-500/40 flex items-center justify-center">
                                                    <ArrowDown className="w-3 h-3 text-cyan-400" />
                                                </div>
                                                {i < chainLinks.length - 1 && (
                                                    <div className="w-0.5 h-5 bg-cyan-500/30" />
                                                )}
                                            </div>
                                            <div className="pt-0.5 min-w-0">
                                                <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{link.file}</p>
                                                <CopyHash hash={link.sha256} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : selectedIncidentId ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
                                    {t('forensic.noChainData')}
                                </p>
                            ) : (
                                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
                                    {t('forensic.selectToViewChain')}
                                </p>
                            )}

                            {/* Collection info */}
                            {forensicMeta && (
                                <div className="border-t border-soar-border pt-3 mt-3">
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <User className="w-3 h-3" />
                                        {forensicMeta.collected_by || 'forensic-service'}
                                    </div>
                                    {forensicMeta.timestamp && (
                                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(forensicMeta.timestamp).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
