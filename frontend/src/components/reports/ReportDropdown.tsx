'use client';

import { useState, useRef, useEffect } from 'react';
import { FileDown, FileText, Globe, FileType, Table, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReportFormat } from '@/types';
import { useTranslationStore } from '@/stores/i18nStore';

interface ReportDropdownProps {
    onGenerate: (format: ReportFormat) => Promise<void>;
    disabled?: boolean;
    className?: string;
}

const formatOptions: { format: ReportFormat; label: string; icon: React.ElementType; descriptionKey: string }[] = [
    { format: 'pdf', label: 'PDF', icon: FileText, descriptionKey: 'reports.formats.pdf' },
    { format: 'html', label: 'HTML', icon: Globe, descriptionKey: 'reports.formats.html' },
    { format: 'docx', label: 'DOCX', icon: FileType, descriptionKey: 'reports.formats.docx' },
    { format: 'csv', label: 'CSV', icon: Table, descriptionKey: 'reports.formats.csv' },
];

export default function ReportDropdown({ onGenerate, disabled = false, className }: ReportDropdownProps) {
    const { t } = useTranslationStore();
    const [isOpen, setIsOpen] = useState(false);
    const [generating, setGenerating] = useState<ReportFormat | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleGenerate = async (format: ReportFormat) => {
        setGenerating(format);
        try {
            await onGenerate(format);
        } finally {
            setGenerating(null);
            setIsOpen(false);
        }
    };

    return (
        <div ref={dropdownRef} className={cn('relative inline-block', className)}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled || generating !== null}
                className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200',
                    'bg-gradient-to-r from-blue-600 to-blue-700 text-white',
                    'hover:from-blue-700 hover:to-blue-800',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'shadow-lg shadow-blue-500/20'
                )}
            >
                {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <FileDown className="w-4 h-4" />
                )}
                <span>{t('reports.actions.generate')}</span>
                <ChevronDown className={cn(
                    'w-4 h-4 transition-transform duration-200',
                    isOpen && 'rotate-180'
                )} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-soar-card border border-soar-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2">
                        <p className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            {t('reports.exportFormat')}
                        </p>
                        {formatOptions.map(({ format, label, icon: Icon, descriptionKey }) => (
                            <button
                                key={format}
                                onClick={() => handleGenerate(format)}
                                disabled={generating !== null}
                                className={cn(
                                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
                                    'text-left transition-colors duration-150',
                                    'hover:bg-soar-accent/10 hover:text-soar-accent',
                                    generating === format && 'bg-soar-accent/10 text-soar-accent'
                                )}
                            >
                                {generating === format ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-soar-accent" />
                                ) : (
                                    <Icon className="w-5 h-5 text-slate-400" />
                                )}
                                <div>
                                    <p className="font-medium text-slate-900 dark:text-white">{label}</p>
                                    <p className="text-xs text-slate-500">{t(descriptionKey)}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
