import { useCallback } from 'react';
import { useAlertsStore } from '@/stores';
import { alertsApi } from '@/lib/api';
import type { Alert } from '@/types';

export function useAlertsData() {
    const {
        alerts,
        selectedAlert,
        filters,
        pagination,
        isLoading,
        setAlerts,
        setSelectedAlert,
        setPagination,
        setLoading,
        updateAlert
    } = useAlertsStore();

    const fetchAlerts = useCallback(async (customPage?: number) => {
        setLoading(true);
        try {
            const response = await alertsApi.getAll({
                page: customPage || pagination.page,
                page_size: pagination.pageSize,
                ...filters
            });
            setAlerts(response.items);
            setPagination({
                page: response.page,
                pageSize: response.page_size,
                total: response.total
            });
        } catch (err) {
            console.error('Failed to load alerts:', err);
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.pageSize, filters, setAlerts, setPagination, setLoading]);

    const loadAlertDetails = useCallback(async (id: string) => {
        setLoading(true);
        try {
            const alert = await alertsApi.getById(id);
            setSelectedAlert(alert);
            return alert;
        } catch (err) {
            console.error('Failed to load alert details:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, [setSelectedAlert, setLoading]);

    const changeAlertStatus = useCallback(async (id: string, status: string) => {
        try {
            const updated = await alertsApi.update(id, { status } as Partial<Alert>);
            updateAlert(id, updated);
            if (selectedAlert?.id === id) {
                setSelectedAlert(updated);
            }
            return updated;
        } catch (err) {
            console.error('Failed to update alert status:', err);
            throw err;
        }
    }, [updateAlert, selectedAlert, setSelectedAlert]);

    return {
        alerts,
        selectedAlert,
        filters,
        pagination,
        isLoading,
        fetchAlerts,
        loadAlertDetails,
        changeAlertStatus
    };
}
