import { useCallback } from 'react';
import { useDashboardStore } from '@/stores';
import { dashboardApi } from '@/lib/api';

export function useDashboardData() {
    const { stats, recentAlerts, isLoading, error, setStats, setRecentAlerts, setLoading, setError } = useDashboardStore();

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [statsData, alertsData] = await Promise.all([
                dashboardApi.getStats(),
                dashboardApi.getRecentAlerts(5)
            ]);
            setStats(statsData);
            setRecentAlerts(alertsData);
        } catch (err: any) {
            console.error('Failed to load dashboard data:', err);
            setError(err.message || 'Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    }, [setStats, setRecentAlerts, setLoading, setError]);

    return {
        stats,
        recentAlerts,
        isLoading,
        error,
        fetchDashboardData
    };
}
