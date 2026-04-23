import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Alert, Incident, DashboardStats, Playbook, PlaybookExecution, AuditLog, Report, ComplianceFramework } from '@/types';

// Auth Store
interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    setAuth: (user: User, token: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
            logout: () => set({ user: null, token: null, isAuthenticated: false }),
        }),
        {
            name: 'auth-storage',
        }
    )
);

export const hasPermission = (user: User | null, requiredPerm: string): boolean => {
    if (!user) return false;
    const normalizedRequired = requiredPerm.replace(':', '.');
    const normalizedPermissions = (user.permissions || []).map((perm) => perm.replace(':', '.'));
    const adminRoleAliases = new Set(['SUPER_ADMIN', 'super_admin', 'Administrator', 'soar_admin']);
    const hasAdminBypass = (user.roles || []).some((role) => adminRoleAliases.has(role.name));

    return hasAdminBypass || normalizedPermissions.includes(normalizedRequired);
};

// Dashboard Store
interface DashboardState {
    stats: DashboardStats | null;
    recentAlerts: Alert[];
    isLoading: boolean;
    error: string | null;
    setStats: (stats: DashboardStats) => void;
    setRecentAlerts: (alerts: Alert[]) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
    stats: null,
    recentAlerts: [],
    isLoading: false,
    error: null,
    setStats: (stats) => set({ stats }),
    setRecentAlerts: (alerts) => set({ recentAlerts: alerts }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
}));

// Alerts Store
interface AlertsState {
    alerts: Alert[];
    selectedAlert: Alert | null;
    filters: {
        severity?: string;
        status?: string;
        source?: string;
    };
    pagination: {
        page: number;
        pageSize: number;
        total: number;
    };
    isLoading: boolean;
    setAlerts: (alerts: Alert[]) => void;
    setSelectedAlert: (alert: Alert | null) => void;
    setFilters: (filters: AlertsState['filters']) => void;
    setPagination: (pagination: Partial<AlertsState['pagination']>) => void;
    setLoading: (loading: boolean) => void;
    addAlert: (alert: Alert) => void;
    updateAlert: (id: string, updates: Partial<Alert>) => void;
}

export const useAlertsStore = create<AlertsState>((set) => ({
    alerts: [],
    selectedAlert: null,
    filters: {},
    pagination: { page: 1, pageSize: 20, total: 0 },
    isLoading: false,
    setAlerts: (alerts) => set({ alerts }),
    setSelectedAlert: (alert) => set({ selectedAlert: alert }),
    setFilters: (filters) => set({ filters }),
    setPagination: (pagination) => set((state) => ({
        pagination: { ...state.pagination, ...pagination }
    })),
    setLoading: (loading) => set({ isLoading: loading }),
    addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts] })),
    updateAlert: (id, updates) => set((state) => ({
        alerts: state.alerts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        selectedAlert: state.selectedAlert?.id === id ? { ...state.selectedAlert, ...updates } : state.selectedAlert,
    })),
}));

// Incidents Store
interface IncidentsState {
    incidents: Incident[];
    selectedIncident: Incident | null;
    isLoading: boolean;
    setIncidents: (incidents: Incident[]) => void;
    setSelectedIncident: (incident: Incident | null) => void;
    setLoading: (loading: boolean) => void;
    addIncident: (incident: Incident) => void;
    updateIncident: (id: string, updates: Partial<Incident>) => void;
}

export const useIncidentsStore = create<IncidentsState>((set) => ({
    incidents: [],
    selectedIncident: null,
    isLoading: false,
    setIncidents: (incidents) => set({ incidents }),
    setSelectedIncident: (incident) => set({ selectedIncident: incident }),
    setLoading: (loading) => set({ isLoading: loading }),
    addIncident: (incident) => set((state) => ({ incidents: [incident, ...state.incidents] })),
    updateIncident: (id, updates) => set((state) => ({
        incidents: state.incidents.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        selectedIncident: state.selectedIncident?.id === id ? { ...state.selectedIncident, ...updates } : state.selectedIncident,
    })),
}));

// Playbooks Store
interface PlaybooksState {
    playbooks: Playbook[];
    selectedPlaybook: Playbook | null;
    executions: PlaybookExecution[];
    isLoading: boolean;
    setPlaybooks: (playbooks: Playbook[]) => void;
    setSelectedPlaybook: (playbook: Playbook | null) => void;
    setExecutions: (executions: PlaybookExecution[]) => void;
    setLoading: (loading: boolean) => void;
}

export const usePlaybooksStore = create<PlaybooksState>((set) => ({
    playbooks: [],
    selectedPlaybook: null,
    executions: [],
    isLoading: false,
    setPlaybooks: (playbooks) => set({ playbooks }),
    setSelectedPlaybook: (playbook) => set({ selectedPlaybook: playbook }),
    setExecutions: (executions) => set({ executions }),
    setLoading: (loading) => set({ isLoading: loading }),
}));

// Audit Logs Store
interface AuditState {
    logs: AuditLog[];
    isLoading: boolean;
    setLogs: (logs: AuditLog[]) => void;
    setLoading: (loading: boolean) => void;
}

export const useAuditStore = create<AuditState>((set) => ({
    logs: [],
    isLoading: false,
    setLogs: (logs) => set({ logs }),
    setLoading: (loading) => set({ isLoading: loading }),
}));

// Reports Store
interface ReportsState {
    reports: Report[];
    isLoading: boolean;
    setReports: (reports: Report[]) => void;
    setLoading: (loading: boolean) => void;
}

export const useReportsStore = create<ReportsState>((set) => ({
    reports: [],
    isLoading: false,
    setReports: (reports) => set({ reports }),
    setLoading: (loading) => set({ isLoading: loading }),
}));

// Compliance Store
interface ComplianceState {
    frameworks: ComplianceFramework[];
    score: number;
    isLoading: boolean;
    setFrameworks: (frameworks: ComplianceFramework[]) => void;
    setScore: (score: number) => void;
    setLoading: (loading: boolean) => void;
}

export const useComplianceStore = create<ComplianceState>((set) => ({
    frameworks: [],
    score: 0,
    isLoading: false,
    setFrameworks: (frameworks) => set({ frameworks }),
    setScore: (score) => set({ score }),
    setLoading: (loading) => set({ isLoading: loading }),
}));

// UI Store
interface UIState {
    sidebarCollapsed: boolean;
    isMobileMenuOpen: boolean;
    theme: 'dark' | 'light';
    activeModule: 'dashboard' | 'alerts' | 'incidents' | 'playbooks' | 'evidence' | 'compliance' | 'reports' | 'audit-logs' | 'settings' | 'profile' | 'user-management' | 'roles-permissions' | 'integrations' | 'system';
    notifications: Array<{
        id: string;
        type: 'success' | 'error' | 'warning' | 'info';
        message: string;
    }>;
    aiDrawer: {
        isOpen: boolean;
        contextType: 'alert' | 'incident' | null;
        contextId: string | null;
    };
    toggleSidebar: () => void;
    toggleMobileMenu: () => void;
    closeMobileMenu: () => void;
    setTheme: (theme: 'dark' | 'light') => void;
    setActiveModule: (module: UIState['activeModule']) => void;
    addNotification: (notification: Omit<UIState['notifications'][0], 'id'>) => void;
    removeNotification: (id: string) => void;
    openAIDrawer: (type: 'alert' | 'incident', id: string) => void;
    closeAIDrawer: () => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            sidebarCollapsed: false,
            isMobileMenuOpen: false,
            theme: 'dark',
            activeModule: 'dashboard',
            notifications: [],
            aiDrawer: { isOpen: false, contextType: null, contextId: null },
            toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
            toggleMobileMenu: () => set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
            closeMobileMenu: () => set({ isMobileMenuOpen: false }),
            setTheme: (theme) => set({ theme }),
            setActiveModule: (module) => set({ activeModule: module }),
            addNotification: (notification) => set((state) => ({
                notifications: [
                    ...state.notifications,
                    { ...notification, id: Math.random().toString(36).substr(2, 9) },
                ],
            })),
            removeNotification: (id) => set((state) => ({
                notifications: state.notifications.filter((n) => n.id !== id),
            })),
            openAIDrawer: (type, id) => set({ aiDrawer: { isOpen: true, contextType: type, contextId: id } }),
            closeAIDrawer: () => set({ aiDrawer: { isOpen: false, contextType: null, contextId: null } }),
        }),
        {
            name: 'soar-ui-storage',
            partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed, theme: state.theme, activeModule: state.activeModule }),
        }
    )
);
