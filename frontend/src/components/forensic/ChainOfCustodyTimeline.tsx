'use client';

import { Link2, User, Clock, Hash, ArrowDown } from 'lucide-react';
import { useTranslationStore } from '@/stores/i18nStore';

interface ChainLink {
    file: string;
    sha256: string;
    previous_hash: string;
    size_bytes?: number;
}

interface CustodyEvent {
    action: string;
    actor_name: string;
    timestamp: string;
    hash_after?: string;
    integrity_verified?: boolean;
    purpose?: string;
}

interface ChainOfCustodyTimelineProps {
    chain?: ChainLink[];
    events?: CustodyEvent[];
    collectedBy?: string;
    collectedAt?: string;
    className?: string;
}

const GENESIS_HASH = '0'.repeat(64);

export default function ChainOfCustodyTimeline({
    chain = [],
    events = [],
    collectedBy = 'forensic-service',
    collectedAt,
    className = '',
}: ChainOfCustodyTimelineProps) {
    const { t } = useTranslationStore();
    return (
        <div className={`bg-soar-bg-secondary rounded-xl border border-soar-border p-4 ${className}`} dir="auto">
            <div className="flex items-center gap-2 mb-4">
                <Link2 className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-200">{t('forensic.chainOfCustody')}</h3>
            </div>

            {/* Hash chain visualization */}
            {chain.length > 0 && (
                <div className="space-y-0 mb-6">
                    {/* Genesis */}
                    <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-500 flex items-center justify-center">
                                <Hash className="w-4 h-4 text-slate-400" />
                            </div>
                            <div className="w-0.5 h-6 bg-slate-600" />
                        </div>
                        <div className="pt-1">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('forensic.genesis')}</p>
                            <p className="text-xs font-mono text-slate-500">{GENESIS_HASH.slice(0, 20)}…</p>
                        </div>
                    </div>

                    {/* Chain links */}
                    {chain.map((link, i) => (
                        <div key={link.file} className="flex items-start gap-3">
                            <div className="flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-cyan-500/10 border-2 border-cyan-500/40 flex items-center justify-center">
                                    <ArrowDown className="w-3 h-3 text-cyan-400" />
                                </div>
                                {i < chain.length - 1 && (
                                    <div className="w-0.5 h-6 bg-cyan-500/30" />
                                )}
                            </div>
                            <div className="pt-1 min-w-0">
                                <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{link.file}</p>
                                <p className="text-xs font-mono text-cyan-600 dark:text-cyan-400/70 truncate">
                                    SHA256: {link.sha256.slice(0, 20)}…
                                </p>
                                <p className="text-xs text-slate-500">
                                    ← {t('forensic.previousHash')} {link.previous_hash.slice(0, 12)}…
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Custody events */}
            {events.length > 0 && (
                <div className="border-t border-soar-border pt-4 space-y-3">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('forensic.custodyLog')}</p>
                    {events.map((evt, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <div className="flex flex-col items-center">
                                <div className="w-6 h-6 rounded-full bg-soar-card flex items-center justify-center">
                                    <User className="w-3 h-3 text-slate-400" />
                                </div>
                                {i < events.length - 1 && (
                                    <div className="w-0.5 h-4 bg-slate-600" />
                                )}
                            </div>
                            <div>
                                <p className="text-xs text-slate-700 dark:text-slate-200">
                                    <span className="font-medium">{evt.actor_name}</span>
                                    {' '}{t('forensic.performed')}{' '}
                                    <span className="text-cyan-600 dark:text-cyan-400">{evt.action}</span>
                                </p>
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(evt.timestamp).toLocaleString()}
                                </p>
                                {evt.purpose && (
                                    <p className="text-xs text-slate-500 mt-0.5 italic">{evt.purpose}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Collection info */}
            {!events.length && (
                <div className="border-t border-soar-border pt-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <User className="w-3 h-3" />
                        {t('forensic.collectedBy')} <span className="text-slate-700 dark:text-slate-300">{collectedBy}</span>
                    </div>
                    {collectedAt && (
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                            <Clock className="w-3 h-3" />
                            {new Date(collectedAt).toLocaleString()}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export type { ChainLink, CustodyEvent };
