'use client';

import { useEffect, useState } from 'react';
import { Plus, PlayCircle, Edit, Trash2, Power, Clock, BookOpen, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { Header } from '@/components/layout';
import { Button, Modal } from '@/components/ui';
import { usePlaybooksStore } from '@/stores';
import { playbooksApi } from '@/lib/api';
import type { Playbook } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import PlaybookForm from './PlaybookForm';
import PlaybookExecutionLog from './PlaybookExecutionLog';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useTranslationStore } from '@/stores/i18nStore';

export default function PlaybooksModule() {
    const { playbooks, setPlaybooks, isLoading, setLoading } = usePlaybooksStore();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isLogOpen, setIsLogOpen] = useState(false);
    const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
    const { t } = useTranslationStore();

    const fetchPlaybooks = async () => {
        try {
            setLoading(true);
            const response = await playbooksApi.getAll();
            const data = Array.isArray(response) ? response : (response.items || []);
            setPlaybooks(data);
        } catch (error) {
            console.error('Failed to fetch playbooks:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlaybooks();
    }, []);

    const handleCreate = () => {
        setSelectedPlaybook(null);
        setIsFormOpen(true);
    };

    const handleEdit = (playbook: Playbook) => {
        setSelectedPlaybook(playbook);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(t('playbooks.confirmDelete'))) return;
        try {
            await playbooksApi.delete(id);
            fetchPlaybooks();
        } catch (error) {
            console.error('Failed to delete playbook:', error);
        }
    };

    const handleRun = async (playbook: Playbook, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await playbooksApi.run(playbook.id, { trigger: 'manual' });
            alert(t('playbooks.triggeredSuccess').replace('{name}', playbook.name));
        } catch (error) {
            console.error('Failed to run playbook:', error);
            alert(t('playbooks.triggeredFailed').replace('{name}', playbook.name));
        }
    };

    const handleToggleStatus = async (playbook: Playbook, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await playbooksApi.update(playbook.id, { is_active: !playbook.is_active });
            fetchPlaybooks();
        } catch (error) {
            console.error('Failed to toggle status:', error);
        }
    };

    const handleViewLogs = (playbook: Playbook, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedPlaybook(playbook);
        setIsLogOpen(true);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-soar-bg">
            <Header
                title={t('playbooks.title')}
                subtitle={t('playbooks.subtitle')}
            />

            <div className="flex-1 overflow-auto p-4 md:p-6">
                <div className="max-w-7xl mx-auto space-y-6">

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <PermissionGuard permissions="playbooks.manage">
                                <Button
                                    variant="primary"
                                    onClick={handleCreate}
                                    className="flex items-center gap-2 shadow-lg shadow-blue-500/20 bg-soar-primary hover:bg-soar-primary/90 text-white"
                                >
                                    <Plus className="w-4 h-4" />
                                    {t('playbooks.create')}
                                </Button>
                            </PermissionGuard>
                        </div>
                    </div>

                    {isLoading && playbooks.length === 0 ? (
                        <div className="flex justify-center items-center h-48">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                        </div>
                    ) : playbooks.length === 0 ? (
                        <div className="bg-white/80 dark:bg-soar-card/50 backdrop-blur-sm border border-soar-border rounded-xl p-10 text-center flex flex-col items-center justify-center">
                            <BookOpen className="w-12 h-12 text-slate-400 dark:text-slate-500 mb-4" />
                            <h3 className="text-xl font-medium text-slate-900 dark:text-slate-300">{t('playbooks.noPlaybooks')}</h3>
                            <p className="text-slate-500 mt-2 max-w-md">{t('playbooks.noPlaybooksDesc')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {playbooks.map((playbook) => (
                                <div
                                    key={playbook.id}
                                    className="group bg-soar-card/60 backdrop-blur-md border border-soar-border hover:border-blue-500/50 rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-blue-500/10 hover:-translate-y-1 flex flex-col"
                                    onClick={() => handleEdit(playbook)}
                                >
                                    {/* Card Header */}
                                    <div className="p-5 border-b border-soar-border flex justify-between items-start cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${playbook.is_active ? 'bg-blue-500/10 text-blue-500' : 'bg-slate-500/10 text-slate-500'}`}>
                                                <BookOpen className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate pe-2" title={playbook.name}>
                                                    {playbook.name}
                                                </h3>
                                                <span className="text-xs text-slate-600 dark:text-slate-500 mt-0.5 inline-block bg-slate-100 dark:bg-soar-bg/50 px-2 py-0.5 rounded">
                                                    {playbook.category || t('playbooks.general')}
                                                </span>
                                                <span className={`text-xs mt-0.5 ms-1 inline-block px-2 py-0.5 rounded font-mono ${(playbook as any).execution_mode === 'AUTO'
                                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                                    }`}>
                                                    {(playbook as any).execution_mode || 'MANUAL'}
                                                </span>
                                            </div>
                                        </div>
                                        <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${playbook.is_active ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'}`}>
                                            {playbook.is_active ? t('playbooks.active') : t('playbooks.disabled')}
                                        </span>
                                    </div>

                                    {/* Card Body */}
                                    <div className="p-5 flex-1 flex flex-col justify-between cursor-pointer">
                                        <p className="text-slate-600 dark:text-slate-500 text-sm line-clamp-3 mb-4 leading-relaxed">
                                            {playbook.description || t('playbooks.noDescription')}
                                        </p>

                                        {/* Stats */}
                                        <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-soar-bg/50 p-3 rounded-lg border border-soar-border">
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs text-slate-500 uppercase tracking-wide">{t('playbooks.runs')}</span>
                                                <span className="text-lg font-bold text-blue-500 flex items-center gap-1.5">
                                                    <Activity className="w-3.5 h-3.5 opacity-70" />
                                                    {playbook.execution_count || 0}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-center border-s border-soar-border">
                                                <span className="text-xs text-slate-500 uppercase tracking-wide">{t('playbooks.success')}</span>
                                                <span className="text-lg font-bold text-emerald-500 flex items-center gap-1.5">
                                                    <CheckCircle className="w-3.5 h-3.5 opacity-70" />
                                                    {playbook.success_count || 0}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-center border-s border-soar-border">
                                                <span className="text-xs text-slate-500 uppercase tracking-wide">{t('playbooks.failed')}</span>
                                                <span className="text-lg font-bold text-rose-500 flex items-center gap-1.5">
                                                    <AlertTriangle className="w-3.5 h-3.5 opacity-70" />
                                                    {playbook.failure_count || 0}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Footer */}
                                    <div className="px-5 py-4 bg-white dark:bg-soar-card/80 border-t border-soar-border flex justify-between items-center z-10">
                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-500 flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            {playbook.last_executed ? formatRelativeTime(playbook.last_executed) : t('playbooks.neverRun')}
                                        </span>

                                        <div className="flex items-center space-x-1.5">
                                            <PermissionGuard permissions="playbooks.execute">
                                                <button
                                                    onClick={(e) => handleRun(playbook, e)}
                                                    title={t('playbooks.runPlaybook')}
                                                    className="p-2 bg-slate-100 dark:bg-soar-bg-secondary text-slate-600 dark:text-slate-500 hover:text-white dark:hover:text-white hover:bg-blue-500 dark:hover:bg-blue-500 rounded-lg transition-all shadow-sm"
                                                >
                                                    <PlayCircle className="w-4 h-4" />
                                                </button>
                                            </PermissionGuard>
                                            <PermissionGuard permissions="playbooks.manage">
                                                <button
                                                    onClick={(e) => handleToggleStatus(playbook, e)}
                                                    title={playbook.is_active ? t('playbooks.disable') : t('playbooks.enable')}
                                                    className={`p-2 bg-slate-100 dark:bg-soar-bg-secondary rounded-lg transition-all shadow-sm ${playbook.is_active ? 'text-emerald-600 dark:text-emerald-500 hover:text-white hover:bg-emerald-500' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                                                >
                                                    <Power className="w-4 h-4" />
                                                </button>
                                            </PermissionGuard>
                                            <button
                                                onClick={(e) => handleViewLogs(playbook, e)}
                                                title={t('playbooks.viewLogs')}
                                                className="p-2 bg-slate-100 dark:bg-soar-bg-secondary text-slate-600 dark:text-slate-500 hover:text-white dark:hover:text-white hover:bg-indigo-500 dark:hover:bg-indigo-500 rounded-lg transition-all shadow-sm"
                                            >
                                                <Clock className="w-4 h-4" />
                                            </button>
                                            <PermissionGuard permissions="playbooks.manage">
                                                <button
                                                    onClick={(e) => handleDelete(playbook.id, e)}
                                                    title={t('playbooks.delete')}
                                                    className="p-2 bg-slate-100 dark:bg-soar-bg-secondary text-slate-600 dark:text-slate-500 hover:text-white dark:hover:text-white hover:bg-rose-500 dark:hover:bg-rose-500 rounded-lg transition-all shadow-sm"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </PermissionGuard>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={selectedPlaybook ? t('playbooks.edit') : t('playbooks.create')}
                size="lg"
            >
                <PlaybookForm
                    initialData={selectedPlaybook}
                    onClose={() => setIsFormOpen(false)}
                    onSave={() => {
                        setIsFormOpen(false);
                        fetchPlaybooks();
                    }}
                />
            </Modal>

            <Modal
                isOpen={isLogOpen}
                onClose={() => setIsLogOpen(false)}
                title={t('playbooks.executionLogs').replace('{name}', selectedPlaybook?.name || '')}
                size="xl"
            >
                {selectedPlaybook && <PlaybookExecutionLog playbook={selectedPlaybook} />}
            </Modal>
        </div>
    );
}
