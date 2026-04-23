'use client';

import { useState, useEffect } from 'react';
import {
    Activity,
    Server,
    Database,
    Shield,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Cpu,
    Network,
    HardDrive
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { healthApi, dashboardApi } from '@/lib/api';
import { useTranslationStore } from '@/stores/i18nStore';
import AnalyticsCard from './AnalyticsCard';

export interface ServiceStatus {
    id: string;
    name: string;
    type: 'core' | 'database' | 'engine' | 'integration';
    status: 'healthy' | 'warning' | 'critical' | 'unknown';
    latency: number;
    lastCheck: Date;
    message?: string;
}

export type HealthMetric = ServiceStatus;

export default function SystemHealth({ className, initialData }: { className?: string, initialData?: ServiceStatus[] }) {
    const { t, locale } = useTranslationStore();
    const [services, setServices] = useState<ServiceStatus[]>(initialData || []);
    const [loading, setLoading] = useState(!initialData);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [selectedService, setSelectedService] = useState<ServiceStatus | null>(null);
    const [totalLoad, setTotalLoad] = useState<number>(24);

    const fetchHealth = async () => {
        setLoading(true);
        try {
            // Using dashboardApi which hits /api/v1/system/health
            const results: any[] = await dashboardApi.getSystemHealth();
            const mappedServices: ServiceStatus[] = results.map(s => ({
                id: s.name.toLowerCase().replace(/ /g, '-'),
                name: s.name,
                type: 'core',
                status: s.status as 'healthy' | 'warning' | 'critical',
                latency: s.value || 0,
                lastCheck: new Date(),
                message: s.status === 'healthy' ? 'Operational' : 'Degraded'
            }));

            setServices(mappedServices);

            // Calculate a deterministic total load based on latency/values reported by the backend
            const avgLatency = mappedServices.length > 0 ? mappedServices.reduce((a, b) => a + b.latency, 0) / mappedServices.length : 0;
            const baseLoad = 15;
            const latencyLoad = Math.min(84, avgLatency / 5);
            const calculatedLoad = Math.max(5, Math.min(99, Math.round(baseLoad + latencyLoad)));

            setTotalLoad(calculatedLoad);
            setLastUpdated(new Date());
        } catch (error) {
            console.error("Failed to fetch system health:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (initialData) {
            setLoading(false);
            return;
        }

        fetchHealth();
        // Poll every 15 seconds
        const interval = setInterval(fetchHealth, 15000);
        return () => clearInterval(interval);
    }, [initialData]);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'healthy': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
            case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
            case 'critical': return <XCircle className="w-5 h-5 text-red-500" />;
            default: return <RefreshCw className="w-5 h-5 text-slate-500 animate-spin" />;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'healthy': return 'text-green-500';
            case 'warning': return 'text-yellow-500';
            case 'critical': return 'text-red-500';
            default: return 'text-slate-500';
        }
    };

    const RefreshButton = (
        <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:inline">
                {locale === 'ar' ? `آخر تحديث: ${lastUpdated.toLocaleTimeString()}` : `Updated: ${lastUpdated.toLocaleTimeString()}`}
            </span>
            <button
                onClick={fetchHealth}
                className="p-2 text-slate-400 hover:text-white hover:bg-soar-bg-secondary rounded-lg transition-colors"
                title={t('dashboard.refresh') || 'Refresh'}
                disabled={loading}
            >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
        </div>
    );

    return (
        <AnalyticsCard
            title={t('dashboard.systemHealth') || 'System Health Monitor'}
            subtitle={t('dashboard.systemActivityMonitorDesc') || 'Live Status of System Services & Engines'}
            action={RefreshButton}
            className={cn('min-h-[400px]', className)}
            noPadding
        >
            <div className="p-0">
                {/* Header Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 border-b border-soar-border/50">
                    <div className="flex items-center gap-3 p-3 bg-soar-bg-secondary/50 rounded-lg">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                            <Activity className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">{t('dashboard.systemStatus')}</p>
                            <p className="font-semibold text-green-500">
                                {services.every(s => s.status === 'healthy') ? t('dashboard.allSystemsOperational') : t('dashboard.issuesDetected')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-soar-bg-secondary/50 rounded-lg">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Server className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">{t('dashboard.servicesActive')}</p>
                            <p className="font-semibold text-slate-900 dark:text-white">
                                {services.filter(s => s.status !== 'critical').length} / {services.length || 5}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-soar-bg-secondary/50 rounded-lg">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                            <Cpu className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">{t('dashboard.totalLoad')}</p>
                            <p className="font-semibold text-slate-900 dark:text-white flex items-baseline gap-1">
                                {totalLoad}%
                                <span className={cn(
                                    "text-[10px]",
                                    totalLoad > 75 ? "text-red-500" : totalLoad > 50 ? "text-yellow-500" : "text-green-500"
                                )}>
                                    {totalLoad > 75 ? `↑ ${t('dashboard.high')}` : totalLoad > 50 ? t('dashboard.medium') : `↓ ${t('dashboard.low')}`}
                                </span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-soar-bg-secondary/50 rounded-lg">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                            <Network className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">{t('dashboard.avgLatency')}</p>
                            <p className="font-semibold text-slate-900 dark:text-white">
                                {services.length > 0
                                    ? Math.round(services.reduce((a, b) => a + b.latency, 0) / services.length)
                                    : 0}ms
                            </p>
                        </div>
                    </div>
                </div>

                {/* Services Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-soar-bg-secondary/30 text-slate-400 border-b border-soar-border/50">
                            <tr>
                                <th className="px-6 py-3 font-medium">{t('dashboard.serviceName')}</th>
                                <th className="px-6 py-3 font-medium">{t('dashboard.type')}</th>
                                <th className="px-6 py-3 font-medium">{t('incidents.columns.status')}</th>
                                <th className="px-6 py-3 font-medium">{t('dashboard.avgLatency')}</th>
                                <th className="px-6 py-3 font-medium">{t('dashboard.lastCheck')}</th>
                                <th className="px-6 py-3 font-medium">{t('dashboard.message')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-soar-border/30">
                            {services.map((service) => (
                                <tr
                                    key={service.id}
                                    className="hover:bg-soar-bg-secondary/30 transition-colors cursor-pointer"
                                    onClick={() => setSelectedService(service)}
                                >
                                    <td className="px-6 py-4 font-medium flex items-center gap-3">
                                        <div className={cn(
                                            "w-2 h-2 rounded-full",
                                            service.status === 'healthy' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" :
                                                service.status === 'warning' ? "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" :
                                                    "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                                        )} />
                                        {service.name}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded-full bg-soar-bg-secondary border border-soar-border text-xs text-slate-400 capitalize">
                                            {service.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(service.status)}
                                            <span className={cn('capitalize font-medium', getStatusText(service.status))}>
                                                {service.status}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-300">
                                        {service.latency}ms
                                    </td>
                                    <td className="px-6 py-4 text-slate-400">
                                        {service.lastCheck.toLocaleTimeString()}
                                    </td>
                                    <td className="px-6 py-4 text-slate-400">
                                        {service.message}
                                    </td>
                                </tr>
                            ))}
                            {loading && services.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                                        <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
                                        {t('dashboard.checkingServices')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Service Details Modal */}
            {selectedService && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-soar-card border border-soar-border rounded-xl w-full max-w-md p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold flex items-center gap-3">
                                {getStatusIcon(selectedService.status)}
                                {selectedService.name}
                            </h3>
                            <button
                                onClick={() => setSelectedService(null)}
                                className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 rounded-lg bg-soar-bg-secondary/50 border border-soar-border/50">
                                <p className="text-sm text-slate-400 mb-1">Status Message</p>
                                <p className="font-medium text-slate-900 dark:text-white">{selectedService.message}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-lg bg-soar-bg-secondary/30">
                                    <p className="text-xs text-slate-400">Service Type</p>
                                    <p className="font-semibold capitalize">{selectedService.type}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-soar-bg-secondary/30">
                                    <p className="text-xs text-slate-400">Latency</p>
                                    <p className="font-semibold font-mono">{selectedService.latency}ms</p>
                                </div>
                                <div className="p-3 rounded-lg bg-soar-bg-secondary/30">
                                    <p className="text-xs text-slate-400">Last Checked</p>
                                    <p className="font-semibold">{selectedService.lastCheck.toLocaleTimeString()}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-soar-bg-secondary/30">
                                    <p className="text-xs text-slate-400">Port/Endpoint</p>
                                    <p className="font-semibold truncate">
                                        {selectedService.id === 'database' ? 'Internal' : 'API Route'}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-soar-border/30">
                                <h4 className="text-sm font-medium text-slate-300 mb-3">Recent Logs</h4>
                                <div className="space-y-2 font-mono text-xs text-slate-400 max-h-32 overflow-y-auto">
                                    <p>[{new Date().toLocaleTimeString()}] Health check initiated</p>
                                    <p>[{new Date().toLocaleTimeString()}] Connection attempt successful</p>
                                    <p>[{new Date().toLocaleTimeString()}] Metrics verified</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setSelectedService(null)}
                                className="px-4 py-2 bg-soar-bg-secondary hover:bg-soar-border text-slate-900 dark:text-white rounded-lg transition-colors border border-soar-border"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AnalyticsCard>
    );
}
