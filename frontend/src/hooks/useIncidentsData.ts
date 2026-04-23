import { useCallback } from 'react';
import { useIncidentsStore } from '@/stores';
import { incidentsApi } from '@/lib/api';

export function useIncidentsData() {
    const { incidents, selectedIncident, isLoading, setIncidents, setSelectedIncident, setLoading } = useIncidentsStore();

    const fetchIncidents = useCallback(async (params?: { page?: number; page_size?: number; status?: string; severity?: string }) => {
        setLoading(true);
        try {
            const response = await incidentsApi.getAll(params);
            setIncidents(response.items);
            return response;
        } catch (err) {
            console.error('Failed to load incidents:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [setIncidents, setLoading]);

    const loadIncidentDetails = useCallback(async (id: string) => {
        setLoading(true);
        try {
            const incident = await incidentsApi.getById(id);
            setSelectedIncident(incident);
            return incident;
        } catch (err) {
            console.error('Failed to load incident details:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [setSelectedIncident, setLoading]);

    return {
        incidents,
        selectedIncident,
        isLoading,
        fetchIncidents,
        loadIncidentDetails
    };
}
