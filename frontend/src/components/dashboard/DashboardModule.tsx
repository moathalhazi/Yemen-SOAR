'use client';

import { useEffect, useState, useCallback, Suspense, lazy } from 'react';
import {
    AlertTriangle,
    FileWarning,
    PlayCircle,
    FileSearch,
    Activity,
    RefreshCw,
    Loader2,
    Server,
    Database,
    Shield,
    Flame
} from 'lucide-react';
import { Header } from '@/components/layout';
import { StatsCard, SeverityBadge, StatusBadge, Button } from '@/components/ui';
import { default as RiskGauge } from '@/components/ui/RiskGauge';
import { formatRelativeTime } from '@/lib/utils';
import { dashboardApi, reportsApi } from '@/lib/api';
import type { DashboardStats, ReportFormat } from '@/types';
import { useDashboardData } from '@/hooks';
import { useUIStore } from '@/stores';
import { useTranslationStore } from '@/stores/i18nStore';

// Import report components
import { ReportDropdown, ReportsSection } from '@/components/reports';
// Removed deleted AuditLogsTable
// Lazy load analytics components
const IncidentsTrend = lazy(() => import('@/components/analytics/IncidentsTrend'));
const SeverityDistribution = lazy(() => import('@/components/analytics/SeverityDistribution'));
const AttackCategories = lazy(() => import('@/components/analytics/AttackCategories'));
const SystemHealth = lazy(() => import('@/components/analytics/SystemHealth'));
const HeatmapDashboard = lazy(() => import('@/components/dashboard/Heatmap'));

// Import types and constants from components
import { ATTACK_COLORS, CategoryData } from '@/components/analytics/AttackCategories';
import { SEVERITY_COLORS, SeverityData } from '@/components/analytics/SeverityDistribution';
import { HealthMetric } from '@/components/analytics/SystemHealth';
import { TrendDataPoint } from '@/components/analytics/IncidentsTrend';

// Default empty stats
const emptyStats: DashboardStats = {
    total_alerts: 0,
    alerts_by_severity: { critical: 0, high: 0, medium: 0, low: 0 },
    alerts_by_status: { new: 0, in_progress: 0, resolved: 0 },
    open_incidents: 0,
    active_playbooks: 0,
    pending_evidence: 0,
    mttd_avg: 0,
    mttr_avg: 0,
};

export default function DashboardModule() {
    const { stats: fetchedStats, recentAlerts, isLoading, error, fetchDashboardData } = useDashboardData();
    const stats = fetchedStats || emptyStats;
    const { setActiveModule } = useUIStore();
    const { t } = useTranslationStore();

    const [reportGenerating, setReportGenerating] = useState(false);
    const [reportSuccess, setReportSuccess] = useState<string | null>(null);

    // Analytics Data State
    const [severityData, setSeverityData] = useState<SeverityData[]>([]);
    const [attackData, setAttackData] = useState<CategoryData[]>([]);
    const [healthData, setHealthData] = useState<HealthMetric[]>([]);
    const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
    const [trendRange, setTrendRange] = useState<'7d' | '30d' | '90d'>('7d');

    // Handle analytics data updates
    useEffect(() => {
        if (fetchedStats) {
            updateDerivedCharts(fetchedStats);
        }
    }, [fetchedStats]);

    // Fetch analytics data
    const fetchAnalyticsData = useCallback(async () => {
        try {
            generateAnalyticsData();
        } catch (err) {
            console.error('Analytics fetch error:', err);
        }
    }, [trendRange]);

    const updateDerivedCharts = (currentStats: DashboardStats) => {
        const sevData: SeverityData[] = [
            { name: 'Critical', value: currentStats.alerts_by_severity.critical || 0, color: SEVERITY_COLORS.critical },
            { name: 'High', value: currentStats.alerts_by_severity.high || 0, color: SEVERITY_COLORS.high },
            { name: 'Medium', value: currentStats.alerts_by_severity.medium || 0, color: SEVERITY_COLORS.medium },
            { name: 'Low', value: currentStats.alerts_by_severity.low || 0, color: SEVERITY_COLORS.low }
        ].filter(d => d.value > 0);
        setSeverityData(sevData.length > 0 ? sevData : []);
    };

    const generateAnalyticsData = async () => {
        try {
            // Fetch analytics in parallel
            const [categoriesRes, trendRes] = await Promise.allSettled([
                dashboardApi.getAttackCategories(),
                dashboardApi.getIncidentsTrend(trendRange)
            ]);

            // Attack Categories
            if (categoriesRes.status === 'fulfilled') {
                const colors = Object.values(ATTACK_COLORS);
                const mappedCategories = categoriesRes.value.map((item: any, index: number) => ({
                    name: item.name,
                    count: item.count,
                    color: ATTACK_COLORS[item.name as keyof typeof ATTACK_COLORS] || colors[index % colors.length]
                }));
                // Only set if we have data, otherwise keep empty or default? 
                // Currently setAttackData([]) is initial state.
                if (mappedCategories.length > 0) {
                    setAttackData(mappedCategories);
                } else {
                    // Start with mock if empty to avoid broken UI in demo? 
                    // User requested REAL data. So if empty, show empty.
                    setAttackData([]);
                }
            }

            // Incidents Trend
            if (trendRes.status === 'fulfilled') {
                const mappedTrend = trendRes.value.map((item: any) => ({
                    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    incidents: item.incidents,
                    alerts: item.alerts,
                    resolved: item.resolved
                }));
                if (mappedTrend.length > 0) {
                    setTrendData(mappedTrend);
                } else {
                    setTrendData([]);
                }
            }

        } catch (error) {
            console.error("Failed to generate analytics:", error);
        }
    };

    // Handle report generation
    const handleGenerateReport = async (format: ReportFormat) => {
        setReportGenerating(true);
        setReportSuccess(null);
        try {
            const newReport = await reportsApi.generate({
                format,
                include_alerts: true,
                include_incidents: true,
                include_audit_logs: true,
                include_metrics: true,
            });

            // Automatically download the generated report
            if (newReport && newReport.id) {
                const blob = await reportsApi.download(newReport.id);
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${newReport.name.replace(/\s+/g, '_')}.${format}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

            setReportSuccess(`${format.toUpperCase()} report generated and downloaded successfully!`);
            setTimeout(() => setReportSuccess(null), 4000);
        } catch (err: any) {
            console.error('Report generation failed:', err);
            // Show actual error
            setReportSuccess(null);
            // Ideally we should have an error state variable here, but for now just logging and ensuring success isn't shown
            alert(`Failed to generate report: ${err.message || 'Unknown error'}`);
        } finally {
            setReportGenerating(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
        fetchAnalyticsData();
        const refreshInterval = setInterval(() => {
            fetchDashboardData();
            fetchAnalyticsData();
        }, 30000);
        return () => clearInterval(refreshInterval);
    }, [fetchDashboardData, fetchAnalyticsData]);

    const MetricLoader = () => (
        <div className="flex items-center justify-center h-full min-h-[200px] bg-soar-card rounded-xl">
            <Loader2 className="w-8 h-8 animate-spin text-soar-accent" />
        </div>
    );

    return (
        <>
            <Header
                title={t('navigation.dashboard')}
                subtitle={t('dashboard.subtitle')}
                actions={
                    <div className="flex items-center gap-3">
                        <ReportDropdown
                            onGenerate={handleGenerateReport}
                            disabled={reportGenerating}
                        />
                        <Button
                            variant="secondary"
                            icon={isLoading ? Loader2 : RefreshCw}
                            onClick={() => {
                                fetchDashboardData();
                                fetchAnalyticsData();
                            }}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Loading...' : 'Refresh'}
                        </Button>
                    </div>
                }
            />

            <div className="space-y-6 mt-16 pb-8">
                {/* Success Message */}
                {reportSuccess && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-400 animate-in fade-in slide-in-from-top-2">
                        <p className="flex items-center gap-2">
                            ✓ {reportSuccess}
                        </p>
                    </div>
                )}

                {/* Error Banner */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
                        <p className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            {error}
                        </p>
                    </div>
                )}

                {/* 1. Security Intelligence (KPIs) */}
                <section>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <StatsCard
                            title={t('dashboard.totalAlerts')}
                            value={stats.total_alerts}
                            icon={AlertTriangle}
                            iconColor="text-orange-500"
                            change={stats.total_alerts > 0 ? { value: 12, type: 'increase' } : undefined}
                        />
                        <StatsCard
                            title={t('dashboard.openIncidents')}
                            value={stats.open_incidents}
                            icon={FileWarning}
                            iconColor="text-red-500"
                            change={stats.open_incidents > 0 ? { value: 5, type: 'decrease' } : undefined}
                        />
                        <StatsCard
                            title={t('dashboard.highRiskIncidents')}
                            value={(stats.alerts_by_severity.critical || 0) + (stats.alerts_by_severity.high || 0)}
                            icon={Flame}
                            iconColor="text-red-400"
                        />
                        <StatsCard
                            title={t('dashboard.activePlaybooks')}
                            value={stats.active_playbooks}
                            icon={PlayCircle}
                            iconColor="text-green-500"
                        />
                        <StatsCard
                            title={t('dashboard.pendingEvidence')}
                            value={stats.pending_evidence}
                            icon={FileSearch}
                            iconColor="text-purple-500"
                        />
                    </div>
                </section>

                {/* 1b. Risk Score Overview */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="card flex flex-col items-center justify-center">
                        <RiskGauge
                            score={
                                stats.total_alerts > 0
                                    ? Math.round(
                                        ((stats.alerts_by_severity.critical || 0) * 95 +
                                            (stats.alerts_by_severity.high || 0) * 78 +
                                            (stats.alerts_by_severity.medium || 0) * 55 +
                                            (stats.alerts_by_severity.low || 0) * 25) / stats.total_alerts
                                    )
                                    : 0
                            }
                            size={180}
                            label={t('dashboard.avgRisk')}
                        />
                        <p className="text-xs text-slate-400 mt-2">{t('dashboard.weightedAvgRisk')}</p>
                    </div>
                    <div className="lg:col-span-2 card">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-900 dark:text-white">
                            <Shield className="w-4 h-4 text-blue-400" />
                            {t('dashboard.riskScoreDistribution')}
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: t('dashboard.critical'), count: stats.alerts_by_severity.critical || 0, color: '#ef4444', range: '90-100' },
                                { label: t('dashboard.high'), count: stats.alerts_by_severity.high || 0, color: '#f97316', range: '75-89' },
                                { label: t('dashboard.medium'), count: stats.alerts_by_severity.medium || 0, color: '#eab308', range: '50-74' },
                                { label: t('dashboard.low'), count: stats.alerts_by_severity.low || 0, color: '#22c55e', range: '0-49' },
                            ].map((zone) => (
                                <div key={zone.label} className="bg-soar-bg rounded-lg p-3 border border-soar-border/50">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: zone.color }} />
                                        <span className="text-xs font-medium" style={{ color: zone.color }}>{zone.label}</span>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{zone.count}</p>
                                    <p className="text-xs text-slate-500 mt-1">{t('dashboard.score')} {zone.range}</p>
                                    {/* Bar visualization */}
                                    <div className="w-full h-1.5 bg-soar-card rounded-full mt-2">
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{
                                                width: `${stats.total_alerts > 0 ? (zone.count / stats.total_alerts * 100) : 0}%`,
                                                backgroundColor: zone.color,
                                                boxShadow: `0 0 8px ${zone.color}40`,
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 2. Reports & Incidents Trend */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Recent Reports (2/3 width) */}
                    <div className="lg:col-span-2">
                        <ReportsSection limit={4} />
                    </div>
                    {/* Incidents Trend (1/3 width) */}
                    <div className="min-h-[350px]">
                        <Suspense fallback={<MetricLoader />}>
                            <IncidentsTrend
                                data={trendData}
                                loading={isLoading}
                                timeRange={trendRange}
                                onTimeRangeChange={setTrendRange}
                                className="h-full"
                            />
                        </Suspense>
                    </div>
                </section>

                {/* 3. Analytics Charts */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Severity Distribution */}
                    <div className="min-h-[350px]">
                        <Suspense fallback={<MetricLoader />}>
                            <SeverityDistribution
                                data={severityData}
                                loading={isLoading}
                                className="h-full"
                            />
                        </Suspense>
                    </div>

                    {/* Attack Categories */}
                    <div className="min-h-[350px]">
                        <Suspense fallback={<MetricLoader />}>
                            <AttackCategories
                                data={attackData}
                                loading={isLoading}
                                className="h-full"
                            />
                        </Suspense>
                    </div>

                </section>

                {/* 4. System Health Monitor */}
                <section className="py-6 my-4">
                    <Suspense fallback={<MetricLoader />}>
                        <SystemHealth className="w-full" />
                    </Suspense>
                </section>

                {/* 5. Heatmaps */}
                <section>
                    <Suspense fallback={<MetricLoader />}>
                        <HeatmapDashboard className="w-full" />
                    </Suspense>
                </section>

                {/* 5. Audit Logs & Recent Alerts */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Audit Activity Placeholder (2/3 width) */}
                    <div className="card lg:col-span-2 flex flex-col items-center justify-center p-8 bg-soar-card border border-soar-border rounded-xl">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-300">{t('dashboard.systemActivityMonitor')}</h3>
                        <p className="text-sm text-slate-500 text-center max-w-sm mt-1">
                            {t('dashboard.systemActivityMonitorDesc')}
                        </p>
                    </div>
                    {/* Recent Alerts (1/3 width) */}
                    <div className="card">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{t('dashboard.recentAlerts')}</h3>
                            <button
                                onClick={() => setActiveModule('alerts')}
                                className="text-soar-accent hover:underline text-sm"
                            >
                                {t('dashboard.viewAll')}
                            </button>
                        </div>
                        {isLoading && recentAlerts.length === 0 ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-soar-accent" />
                            </div>
                        ) : recentAlerts.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>{t('dashboard.noAlertsYet')}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {recentAlerts.slice(0, 4).map((alert) => (
                                    <div
                                        key={alert.id}
                                        className="flex items-center justify-between p-3 bg-soar-bg rounded-lg hover:bg-soar-bg/80 transition-colors cursor-pointer"
                                        onClick={() => {
                                            setActiveModule('alerts');
                                        }}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <SeverityBadge severity={alert.severity} />
                                            <div className="min-w-0">
                                                <p className="font-medium truncate text-sm">{alert.title}</p>
                                                <p className="text-xs text-slate-400">{formatRelativeTime(alert.received_at)}</p>
                                            </div>
                                        </div>
                                        <StatusBadge status={alert.status} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* 5. Status Summary */}
                <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-soar-card rounded-xl border border-soar-border p-4 sm:p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-400">{t('dashboard.newAlerts')}</p>
                                <p className="text-3xl font-bold text-yellow-500 mt-1">{stats.alerts_by_status.new || 0}</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-6 h-6 text-yellow-500" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-soar-card rounded-xl border border-soar-border p-4 sm:p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-400">{t('dashboard.inProgress')}</p>
                                <p className="text-3xl font-bold text-blue-500 mt-1">{stats.alerts_by_status.in_progress || 0}</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                <Activity className="w-6 h-6 text-blue-500" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-soar-card rounded-xl border border-soar-border p-4 sm:p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-400">{t('dashboard.resolved')}</p>
                                <p className="text-3xl font-bold text-green-500 mt-1">{stats.alerts_by_status.resolved || 0}</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                                <PlayCircle className="w-6 h-6 text-green-500" />
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}
