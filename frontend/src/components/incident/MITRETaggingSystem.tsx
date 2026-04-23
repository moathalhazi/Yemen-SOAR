'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, X, Search, Check, Loader2 } from 'lucide-react';
import { incidentsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTranslationStore } from '@/stores/i18nStore';

interface MITRETaggingSystemProps {
    incidentId: string;
    currentTechniques: string[];
    onUpdate: (newTechniques: string[]) => void;
    className?: string;
}

// Common MITRE techniques for the combobox
const COMMON_TECHNIQUES = [
    { id: 'T1566', name: 'Phishing', tactic: 'Initial Access' },
    { id: 'T1190', name: 'Exploit Public-Facing Application', tactic: 'Initial Access' },
    { id: 'T1133', name: 'External Remote Services', tactic: 'Initial Access' },
    { id: 'T1078', name: 'Valid Accounts', tactic: 'Initial Access' },
    { id: 'T1059', name: 'Command and Scripting Interpreter', tactic: 'Execution' },
    { id: 'T1204', name: 'User Execution', tactic: 'Execution' },
    { id: 'T1547', name: 'Boot or Logon Autostart Execution', tactic: 'Persistence' },
    { id: 'T1053', name: 'Scheduled Task/Job', tactic: 'Persistence' },
    { id: 'T1068', name: 'Exploitation for Privilege Escalation', tactic: 'Privilege Escalation' },
    { id: 'T1070', name: 'Indicator Removal', tactic: 'Defense Evasion' },
    { id: 'T1027', name: 'Obfuscated Files or Information', tactic: 'Defense Evasion' },
    { id: 'T1110', name: 'Brute Force', tactic: 'Credential Access' },
    { id: 'T1003', name: 'OS Credential Dumping', tactic: 'Credential Access' },
    { id: 'T1046', name: 'Network Service Discovery', tactic: 'Discovery' },
    { id: 'T1087', name: 'Account Discovery', tactic: 'Discovery' },
    { id: 'T1021', name: 'Remote Services', tactic: 'Lateral Movement' },
    { id: 'T1041', name: 'Exfiltration Over C2 Channel', tactic: 'Exfiltration' },
    { id: 'T1071', name: 'Application Layer Protocol', tactic: 'Command and Control' },
    { id: 'T1486', name: 'Data Encrypted for Impact', tactic: 'Impact' },
    { id: 'T1489', name: 'Service Stop', tactic: 'Impact' },
];

export default function MITRETaggingSystem({
    incidentId,
    currentTechniques,
    onUpdate,
    className = ''
}: MITRETaggingSystemProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslationStore();

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredTechniques = COMMON_TECHNIQUES.filter(tech =>
        tech.id.toLowerCase().includes(search.toLowerCase()) ||
        tech.name.toLowerCase().includes(search.toLowerCase()) ||
        tech.tactic.toLowerCase().includes(search.toLowerCase())
    );

    const handleAdd = async (techId: string) => {
        if (currentTechniques.includes(techId) || isSaving) return;

        setIsSaving(true);
        const newTags = [...currentTechniques, techId];
        try {
            await incidentsApi.update(incidentId, { mitre_techniques: newTags });
            onUpdate(newTags);
            setSearch('');
            setIsOpen(false);
        } catch (error) {
            console.error('Failed to add MITRE technique:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemove = async (techId: string) => {
        if (isSaving) return;

        setIsSaving(true);
        const newTags = currentTechniques.filter(t => t !== techId);
        try {
            await incidentsApi.update(incidentId, { mitre_techniques: newTags });
            onUpdate(newTags);
        } catch (error) {
            console.error('Failed to remove MITRE technique:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={cn("relative", className)} ref={wrapperRef}>
            <div className="flex flex-wrap gap-2 items-center">
                {currentTechniques.map((tech) => {
                    const knownTech = COMMON_TECHNIQUES.find(t => t.id === tech);
                    return (
                        <div
                            key={tech}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-xs font-mono group transition-colors hover:border-red-500/40"
                            title={knownTech ? `${knownTech.name} (${knownTech.tactic})` : 'Unknown Technique'}
                        >
                            <span className="font-bold">{tech}</span>
                            <button
                                onClick={() => handleRemove(tech)}
                                disabled={isSaving}
                                className="text-red-400 opacity-50 hover:opacity-100 transition-opacity ml-1 focus:outline-none disabled:opacity-30"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    );
                })}

                <button
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={isSaving}
                    className="flex items-center gap-1 px-2.5 py-1 bg-soar-bg-secondary border border-dashed border-soar-border hover:border-slate-500 text-slate-400 rounded text-xs transition-colors h-[26px]"
                >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    {t('mitre.addTactic')}
                </button>
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute start-0 top-full mt-2 w-[320px] bg-soar-card border border-soar-border rounded-lg shadow-xl z-50 animate-fade-in">
                    <div className="p-2 border-b border-soar-border relative">
                        <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('mitre.searchPlaceholder')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-soar-bg border border-soar-border rounded ps-9 pe-3 py-1.5 text-sm focus:outline-none focus:border-cyan-500 transition-colors text-slate-900 dark:text-slate-100"
                            autoFocus
                        />
                    </div>

                    <div className="max-h-[280px] overflow-y-auto p-1 custom-scrollbar">
                        {filteredTechniques.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">{t('mitre.noTechniques')}</p>
                        ) : (
                            filteredTechniques.map((tech) => {
                                const isAdded = currentTechniques.includes(tech.id);
                                return (
                                    <button
                                        key={tech.id}
                                        onClick={() => handleAdd(tech.id)}
                                        disabled={isAdded || isSaving}
                                        className={cn(
                                            "w-full flex items-center justify-between p-2 rounded text-left transition-colors",
                                            isAdded ? "opacity-50 cursor-not-allowed" : "hover:bg-soar-bg-secondary"
                                        )}
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs font-bold text-red-400">{tech.id}</span>
                                                <span className="text-xs text-slate-900 dark:text-slate-200 truncate">{tech.name}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-0.5">{tech.tactic}</p>
                                        </div>
                                        {isAdded && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
                                    </button>
                                );
                            })
                        )}

                        {/* Allow adding custom arbitrary techniques not in the list if typed matching TXXXX format */}
                        {search.match(/^T\d{4}(\.\d{3})?$/i) && filteredTechniques.length === 0 && (
                            <button
                                onClick={() => handleAdd(search.toUpperCase())}
                                disabled={currentTechniques.includes(search.toUpperCase()) || isSaving}
                                className="w-full flex items-center justify-between p-2 rounded text-left hover:bg-soar-bg-secondary transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-red-400">{search.toUpperCase()}</span>
                                    <span className="text-xs text-slate-400 italic">{t('mitre.addCustom')}</span>
                                </div>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
