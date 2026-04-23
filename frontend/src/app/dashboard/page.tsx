'use client';

import { Suspense, lazy } from 'react';
import { useUIStore } from '@/stores';
import { Loader2 } from 'lucide-react';

const DashboardModule = lazy(() => import('@/components/dashboard/DashboardModule'));
const AlertsModule = lazy(() => import('@/components/alerts/AlertsModule'));
const IncidentsModule = lazy(() => import('@/components/incident/IncidentsModule'));
const ForensicModule = lazy(() => import('@/components/forensic/ForensicModule'));
const PlaybooksModule = lazy(() => import('@/components/playbooks/PlaybooksModule'));
const AuditLogsModule = lazy(() => import('@/components/audit/AuditLogsModule'));
const ReportsModule = lazy(() => import('@/components/reports/ReportsModule'));
const ComplianceModule = lazy(() => import('@/components/compliance/ComplianceModule'));

const ProfileModule = lazy(() => import('@/components/settings/ProfileModule'));
const UserManagementModule = lazy(() => import('@/components/settings/UserManagementModule'));
const RolesPermissionsModule = lazy(() => import('@/components/settings/RolesPermissionsModule'));
const IntegrationsModule = lazy(() => import('@/components/settings/IntegrationsModule'));
const SystemModule = lazy(() => import('@/components/settings/SystemModule'));

const LoadingFallback = () => (
    <div className="min-h-[500px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-soar-accent animate-spin" />
    </div>
);

export default function SOCDashboardContainer() {
    const { activeModule } = useUIStore();

    return (
        <div className="w-full h-full">
            <Suspense fallback={<LoadingFallback />}>
                {activeModule === 'dashboard' && <DashboardModule />}
                {activeModule === 'alerts' && <AlertsModule />}
                {activeModule === 'incidents' && <IncidentsModule />}
                {activeModule === 'evidence' && <ForensicModule />}
                {activeModule === 'playbooks' && <PlaybooksModule />}
                {activeModule === 'audit-logs' && <AuditLogsModule />}
                {activeModule === 'reports' && <ReportsModule />}
                {activeModule === 'compliance' && <ComplianceModule />}

                {activeModule === 'profile' && <ProfileModule />}
                {activeModule === 'user-management' && <UserManagementModule />}
                {activeModule === 'roles-permissions' && <RolesPermissionsModule />}
                {activeModule === 'integrations' && <IntegrationsModule />}
                {activeModule === 'system' && <SystemModule />}

                {/* Fallback for undeveloped modules */}
                {!['dashboard', 'alerts', 'incidents', 'evidence', 'playbooks', 'audit-logs', 'reports', 'compliance', 'profile', 'user-management', 'roles-permissions', 'integrations', 'system'].includes(activeModule) && (
                    <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-400">
                        <h2 className="text-2xl font-bold mb-2">Module Not Found</h2>
                        <p>The requested module "{activeModule}" is currently under construction or not available.</p>
                    </div>
                )}
            </Suspense>
        </div>
    );
}
