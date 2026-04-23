'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import type { Playbook } from '@/types';
import { playbooksApi } from '@/lib/api';
import { useTranslationStore } from '@/stores/i18nStore';

interface PlaybookFormProps {
    initialData?: Playbook | null;
    onClose: () => void;
    onSave: () => void;
}

export default function PlaybookForm({ initialData, onClose, onSave }: PlaybookFormProps) {
    const { t } = useTranslationStore();
    const [name, setName] = useState(initialData?.name || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [category, setCategory] = useState(initialData?.category || 'General');
    const [riskThreshold, setRiskThreshold] = useState<number>(
        (initialData?.trigger_conditions as any)?.risk_score_above || 75
    );
    const [actions, setActions] = useState({
        notify: (initialData?.workflow as any)?.notify || false,
        trigger_forensic: (initialData?.workflow as any)?.trigger_forensic || false,
        ai_analysis: (initialData?.workflow as any)?.ai_analysis || false,
        update_status: (initialData?.workflow as any)?.update_status || 'contained'
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        const payload: Partial<Playbook> = {
            name,
            description,
            category,
            trigger_conditions: { risk_score_above: riskThreshold },
            workflow: { ...actions },
            is_active: initialData ? initialData.is_active : true,
        };

        try {
            if (initialData?.id) {
                await playbooksApi.update(initialData.id, payload);
            } else {
                await playbooksApi.create(payload as any);
            }
            onSave();
        } catch (error) {
            console.error('Failed to save playbook:', error);
            alert('Failed to save playbook details.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('playbooks.form.playbookName')}</label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-white dark:bg-soar-bg border border-slate-300 dark:border-soar-border rounded p-2 text-slate-900 dark:text-white"
                        placeholder={t('playbooks.form.namePlaceholder')}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('playbooks.form.description')}</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-white dark:bg-soar-bg border border-slate-300 dark:border-soar-border rounded p-2 text-slate-900 dark:text-white h-24"
                        placeholder={t('playbooks.form.descPlaceholder')}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('playbooks.form.category')}</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full bg-white dark:bg-soar-bg border border-slate-300 dark:border-soar-border rounded p-2 text-slate-900 dark:text-white"
                        >
                            <option value="General">{t('playbooks.form.categories.general')}</option>
                            <option value="Malware">{t('playbooks.form.categories.malware')}</option>
                            <option value="Phishing">{t('playbooks.form.categories.phishing')}</option>
                            <option value="Data Exfiltration">{t('playbooks.form.categories.dataExfiltration')}</option>
                            <option value="Insider Threat">{t('playbooks.form.categories.insiderThreat')}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('playbooks.form.triggerRisk')}</label>
                        <input
                            type="number"
                            min="0" max="100"
                            value={riskThreshold}
                            onChange={(e) => setRiskThreshold(Number(e.target.value))}
                            className="w-full bg-white dark:bg-soar-bg border border-slate-300 dark:border-soar-border rounded p-2 text-slate-900 dark:text-white"
                        />
                    </div>
                </div>

                <div className="border-t border-soar-border pt-4 mt-4">
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t('playbooks.form.automatedActions')}</h4>

                    <div className="space-y-3">
                        <label className="flex items-center gap-3 space-x-0">
                            <input
                                type="checkbox"
                                checked={actions.notify}
                                onChange={(e) => setActions({ ...actions, notify: e.target.checked })}
                                className="w-4 h-4 bg-white dark:bg-soar-bg border border-slate-300 dark:border-soar-border rounded text-soar-primary focus:ring-soar-primary"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">{t('playbooks.form.notifyLead')}</span>
                        </label>

                        <label className="flex items-center gap-3 space-x-0">
                            <input
                                type="checkbox"
                                checked={actions.trigger_forensic}
                                onChange={(e) => setActions({ ...actions, trigger_forensic: e.target.checked })}
                                className="w-4 h-4 bg-white dark:bg-soar-bg border border-slate-300 dark:border-soar-border rounded text-soar-primary focus:ring-soar-primary"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">{t('playbooks.form.triggerForensic')}</span>
                        </label>

                        <label className="flex items-center gap-3 space-x-0">
                            <input
                                type="checkbox"
                                checked={actions.ai_analysis}
                                onChange={(e) => setActions({ ...actions, ai_analysis: e.target.checked })}
                                className="w-4 h-4 bg-white dark:bg-soar-bg border border-slate-300 dark:border-soar-border rounded text-soar-primary focus:ring-soar-primary"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">{t('playbooks.form.callAI')}</span>
                        </label>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 space-x-0 pt-2">
                            <span className="text-sm text-slate-700 dark:text-slate-300 min-w-[140px]">{t('playbooks.form.updateIncident')}</span>
                            <select
                                value={actions.update_status}
                                onChange={(e) => setActions({ ...actions, update_status: e.target.value })}
                                className="bg-white dark:bg-soar-bg border border-slate-300 dark:border-soar-border rounded p-1.5 text-sm text-slate-900 dark:text-white w-full sm:max-w-[200px]"
                            >
                                <option value="investigating">{t('playbooks.form.status.investigating')}</option>
                                <option value="contained">{t('playbooks.form.status.contained')}</option>
                                <option value="eradicated">{t('playbooks.form.status.eradicated')}</option>
                                <option value="closed">{t('playbooks.form.status.closed')}</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 space-x-0 pt-4 border-t border-soar-border">
                <Button variant="secondary" onClick={onClose} type="button" disabled={isSaving}>
                    {t('playbooks.form.cancel')}
                </Button>
                <Button variant="primary" type="submit" isLoading={isSaving} disabled={isSaving}>
                    {initialData ? t('playbooks.form.saveChanges') : t('playbooks.form.create')}
                </Button>
            </div>
        </form>
    );
}
