'use client';

import { useState } from 'react';
import { ExternalLink, Info } from 'lucide-react';
import { useTranslationStore } from '@/stores/i18nStore';

interface MITRETechnique {
    id: string;
    name: string;
    description?: string;
}

interface MITREAttackMapProps {
    techniques: string[];
    explanations?: Record<string, { name: string; description: string }>;
    className?: string;
}

// ATT&CK Tactic columns
const TACTICS = [
    { id: 'initial-access', name: 'Initial Access', color: '#ef4444' },
    { id: 'execution', name: 'Execution', color: '#f97316' },
    { id: 'persistence', name: 'Persistence', color: '#eab308' },
    { id: 'priv-escalation', name: 'Privilege Escalation', color: '#84cc16' },
    { id: 'defense-evasion', name: 'Defense Evasion', color: '#22c55e' },
    { id: 'credential-access', name: 'Credential Access', color: '#14b8a6' },
    { id: 'discovery', name: 'Discovery', color: '#06b6d4' },
    { id: 'lateral-movement', name: 'Lateral Movement', color: '#3b82f6' },
    { id: 'exfiltration', name: 'Exfiltration', color: '#8b5cf6' },
    { id: 'command-control', name: 'Command & Control', color: '#a855f7' },
    { id: 'impact', name: 'Impact', color: '#ec4899' },
];

// Map technique IDs to tactics
const TECHNIQUE_TACTIC_MAP: Record<string, string> = {
    'T1566': 'initial-access', 'T1566.001': 'initial-access', 'T1566.002': 'initial-access',
    'T1190': 'initial-access', 'T1133': 'initial-access', 'T1078': 'initial-access',
    'T1189': 'initial-access',
    'T1059': 'execution', 'T1059.001': 'execution', 'T1204': 'execution', 'T1203': 'execution',
    'T1547': 'persistence', 'T1053': 'persistence', 'T1136': 'persistence', 'T1543': 'persistence',
    'T1068': 'priv-escalation', 'T1548': 'priv-escalation', 'T1134': 'priv-escalation',
    'T1070': 'defense-evasion', 'T1027': 'defense-evasion', 'T1562': 'defense-evasion', 'T1036': 'defense-evasion',
    'T1110': 'credential-access', 'T1003': 'credential-access', 'T1558': 'credential-access', 'T1552': 'credential-access',
    'T1046': 'discovery', 'T1087': 'discovery',
    'T1021': 'lateral-movement', 'T1570': 'lateral-movement',
    'T1041': 'exfiltration', 'T1048': 'exfiltration', 'T1567': 'exfiltration',
    'T1071': 'command-control', 'T1105': 'command-control', 'T1573': 'command-control',
    'T1486': 'impact', 'T1489': 'impact', 'T1531': 'impact',
};

export default function MITREAttackMap({
    techniques,
    explanations,
    className = '',
}: MITREAttackMapProps) {
    const [hoveredTech, setHoveredTech] = useState<string | null>(null);
    const { t } = useTranslationStore();

    // Group techniques by tactic
    const groupedByTactic: Record<string, string[]> = {};
    for (const tech of techniques) {
        const tactic = TECHNIQUE_TACTIC_MAP[tech] || 'initial-access';
        if (!groupedByTactic[tactic]) groupedByTactic[tactic] = [];
        groupedByTactic[tactic].push(tech);
    }

    const activeTactics = TACTICS.filter(t => groupedByTactic[t.id]);

    if (techniques.length === 0) {
        return (
            <div className={`bg-soar-bg-secondary rounded-xl border border-soar-border p-6 ${className}`}>
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    {t('mitre.mapping')}
                </h3>
                <p className="text-sm text-slate-400 text-center py-4">{t('mitre.noMapping')}</p>
            </div>
        );
    }

    return (
        <div className={`bg-soar-bg-secondary rounded-xl border border-soar-border p-4 ${className}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    {t('mitre.mapping')}
                </h3>
                <span className="text-xs text-slate-400 bg-soar-card px-2 py-1 rounded border border-soar-border">
                    {t('mitre.identified').replace('{count}', techniques.length.toString())}
                </span>
            </div>

            {/* Tactic columns */}
            <div className="grid gap-3" style={{
                gridTemplateColumns: `repeat(${Math.min(activeTactics.length, 6)}, 1fr)`
            }}>
                {activeTactics.map((tactic) => (
                    <div key={tactic.id} className="space-y-2">
                        {/* Tactic header */}
                        <div
                            className="text-xs font-medium text-center py-1.5 rounded-t-lg"
                            style={{
                                backgroundColor: `${tactic.color}15`,
                                borderBottom: `2px solid ${tactic.color}`,
                                color: tactic.color,
                            }}
                        >
                            {tactic.name}
                        </div>

                        {/* Technique cells */}
                        {(groupedByTactic[tactic.id] || []).map((techId) => {
                            const info = explanations?.[techId];
                            const isHovered = hoveredTech === techId;

                            return (
                                <div
                                    key={techId}
                                    className="relative"
                                    onMouseEnter={() => setHoveredTech(techId)}
                                    onMouseLeave={() => setHoveredTech(null)}
                                >
                                    <div
                                        className="text-xs p-2 rounded-lg border cursor-pointer transition-all duration-200"
                                        style={{
                                            backgroundColor: isHovered ? `${tactic.color}20` : `${tactic.color}08`,
                                            borderColor: isHovered ? tactic.color : `${tactic.color}30`,
                                            boxShadow: isHovered ? `0 0 12px ${tactic.color}30` : 'none',
                                        }}
                                    >
                                        <div className="font-mono font-bold" style={{ color: tactic.color }}>
                                            {techId}
                                        </div>
                                        {info && (
                                            <div className="text-slate-400 mt-0.5 leading-tight">
                                                {info.name}
                                            </div>
                                        )}
                                    </div>

                                    {/* Tooltip */}
                                    {isHovered && info?.description && (
                                        <div className="absolute z-50 bottom-full start-0 mb-2 w-64 p-3 bg-soar-bg border border-soar-border rounded-lg shadow-xl">
                                            <div className="flex items-center gap-1 mb-1">
                                                <Info className="w-3 h-3 text-blue-400" />
                                                <span className="text-xs font-bold" style={{ color: tactic.color }}>{techId}</span>
                                                <span className="text-xs text-slate-300">— {info.name}</span>
                                            </div>
                                            <p className="text-xs text-slate-400 leading-relaxed">{info.description}</p>
                                            <a
                                                href={`https://attack.mitre.org/techniques/${techId.replace('.', '/')}/`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-400 hover:underline mt-2 inline-flex items-center gap-1"
                                            >
                                                {t('mitre.viewAttack')} <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}
