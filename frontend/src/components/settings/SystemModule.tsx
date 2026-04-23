'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, Server, Clock, HardDrive, BellRing, DatabaseBackup } from 'lucide-react';
import { Button, Input, Label } from '@/components/ui';
import { systemApi } from '@/lib/api';
import { useTranslationStore } from '@/stores/i18nStore';

export default function SystemModule() {
    const { t } = useTranslationStore();
    const [isSaving, setIsSaving] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [config, setConfig] = useState({
        hostname: '',
        timezone: 'UTC',
        retentionAlerts: '90',
        retentionIncidents: '365',
        retentionEvidence: '1825',
        maxUploadSize: '500',
        autoBackupInterval: '24',
        smtpServer: '',
        smtpPort: '587'
    });

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        setIsFetching(true);
        setError(null);
        try {
            const data = await systemApi.getConfig();
            if (data) {
                // Merge fetched config safely
                setConfig(prev => ({ ...prev, ...data }));
            }
        } catch (err: any) {
            console.error('Failed to fetch system config:', err);
            setError(err.message || t('system.errorLoading'));
        } finally {
            setIsFetching(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await systemApi.updateConfig(config);
            alert(t('system.notifications.updateSuccess'));
        } catch (err: any) {
            alert(t('system.notifications.updateFailed', { error: err.message }));
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestSmtp = async () => {
        try {
            const res = await systemApi.testSmtp();
            alert(`${t('system.notifications.smtpTest')}: ${res.message || t('system.notifications.success')}`);
        } catch (err: any) {
            alert(t('system.notifications.smtpTestFailed', { error: err.message }));
        }
    };

    const handleTriggerBackup = async () => {
        try {
            const res = await systemApi.triggerBackup();
            alert(`${t('system.notifications.backupTriggered')}: ${res.message || t('system.notifications.success')}`);
        } catch (err: any) {
            alert(t('system.notifications.backupFailed', { error: err.message }));
        }
    };

    const handleChange = (key: keyof typeof config, value: string) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    if (isFetching) {
        return <div className="p-8 text-center text-slate-500 dark:text-slate-400">{t('system.loading')}</div>;
    }

    if (error) {
        return (
            <div className="space-y-6 max-w-5xl mx-auto">
                <div className="p-8 text-center text-red-500 border border-red-500/20 bg-red-500/10 rounded-xl">
                    <p className="font-bold mb-2">{t('system.errorTitle')}</p>
                    <p>{error}</p>
                    <Button onClick={fetchConfig} variant="ghost" className="mt-4 border border-red-500/50 hover:bg-red-500/20">
                        {t('system.retry')}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-start">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Settings className="w-8 h-8 text-soar-accent" />
                        {t('system.title')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">{t('system.subtitle')}</p>
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                    <Save className="w-4 h-4" />
                    {isSaving ? t('system.applying') : t('system.saveBtn')}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* General Settings */}
                <div className="bg-soar-card border border-soar-border rounded-xl p-6 space-y-4 text-start">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                        <Server className="w-5 h-5 text-soar-accent" /> {t('system.general.title')}
                    </h3>

                    <div className="space-y-2">
                        <Label>{t('system.general.hostname')}</Label>
                        <Input
                            value={config.hostname}
                            onChange={(e) => handleChange('hostname', e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t('system.general.timezone')}</Label>
                        <select
                            className="w-full bg-soar-bg border border-soar-border rounded-lg p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-soar-accent/50"
                            value={config.timezone}
                            onChange={(e) => handleChange('timezone', e.target.value)}
                        >
                            <option value="UTC">UTC (Universal Coordinated Time)</option>
                            <option value="EST">EST (Eastern Standard Time)</option>
                            <option value="PST">PST (Pacific Standard Time)</option>
                            <option value="GMT">GMT (Greenwich Mean Time)</option>
                        </select>
                    </div>
                </div>

                {/* Storage & Retention */}
                <div className="bg-soar-card border border-soar-border rounded-xl p-6 space-y-4 text-start">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                        <HardDrive className="w-5 h-5 text-soar-accent" /> {t('system.storage.title')}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('system.storage.alerts')}</Label>
                            <Input
                                type="number"
                                value={config.retentionAlerts}
                                onChange={(e) => handleChange('retentionAlerts', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('system.storage.incidents')}</Label>
                            <Input
                                type="number"
                                value={config.retentionIncidents}
                                onChange={(e) => handleChange('retentionIncidents', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('system.storage.evidence')}</Label>
                            <Input
                                type="number"
                                value={config.retentionEvidence}
                                onChange={(e) => handleChange('retentionEvidence', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('system.storage.maxUpload')}</Label>
                            <Input
                                type="number"
                                value={config.maxUploadSize}
                                onChange={(e) => handleChange('maxUploadSize', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Backup Configuration */}
                <div className="bg-soar-card border border-soar-border rounded-xl p-6 space-y-4 text-start">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                        <DatabaseBackup className="w-5 h-5 text-soar-accent" /> {t('system.backup.title')}
                    </h3>

                    <div className="space-y-2">
                        <Label>{t('system.backup.interval')}</Label>
                        <Input
                            type="number"
                            value={config.autoBackupInterval}
                            onChange={(e) => handleChange('autoBackupInterval', e.target.value)}
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('system.backup.desc')}</p>
                    </div>

                    <div className="pt-4 border-t border-soar-border">
                        <Button variant="secondary" className="w-full gap-2" onClick={handleTriggerBackup}>
                            <Clock className="w-4 h-4" /> {t('system.backup.trigger')}
                        </Button>
                    </div>
                </div>

                {/* Notification Settings */}
                <div className="bg-soar-card border border-soar-border rounded-xl p-6 space-y-4 text-start">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                        <BellRing className="w-5 h-5 text-soar-accent" /> {t('system.smtp.title')}
                    </h3>

                    <div className="space-y-2">
                        <Label>{t('system.smtp.server')}</Label>
                        <Input
                            value={config.smtpServer}
                            onChange={(e) => handleChange('smtpServer', e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t('system.smtp.port')}</Label>
                        <Input
                            type="number"
                            value={config.smtpPort}
                            onChange={(e) => handleChange('smtpPort', e.target.value)}
                        />
                    </div>

                    <div className="pt-4 border-t border-soar-border">
                        <Button onClick={handleTestSmtp} variant="ghost" className="w-full text-slate-500 dark:text-slate-400 border border-slate-700 hover:text-white hover:bg-soar-bg">
                            {t('system.smtp.test')}
                        </Button>
                    </div>
                </div>

            </div>
        </div>
    );
}
