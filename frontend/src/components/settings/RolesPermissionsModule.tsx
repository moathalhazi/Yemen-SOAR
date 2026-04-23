'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Save, Users, Key, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';
import { rolesApi, permissionsApi } from '@/lib/api';
import { useAuthStore, hasPermission } from '@/stores';
import { useTranslationStore } from '@/stores/i18nStore';

export default function RolesPermissionsModule() {
    const { t } = useTranslationStore();
    const { user } = useAuthStore();
    const canManageRoles = hasPermission(user, 'roles.manage');

    const [isSaving, setIsSaving] = useState(false);

    const [roles, setRoles] = useState<any[]>([]);
    const [allPermissions, setAllPermissions] = useState<any[]>([]);
    const [permissionsMap, setPermissionsMap] = useState<Record<string, Record<string, boolean>>>({});
    const [isFetching, setIsFetching] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsFetching(true);
        setError(null);
        try {
            const [fetchedRoles, fetchedPerms] = await Promise.all([
                rolesApi.getAll(),
                permissionsApi.getAll()
            ]);

            const rolesList = Array.isArray(fetchedRoles) ? fetchedRoles : (fetchedRoles as any)?.items || [];

            // Map permissions into categories
            const permsList = Array.isArray(fetchedPerms) ? fetchedPerms : (fetchedPerms as any)?.items || [];
            const groupMap: Record<string, string[]> = {};

            permsList.forEach((p: any) => {
                const category = p.module_name.charAt(0).toUpperCase() + p.module_name.slice(1);
                const permString = p.permission_key;
                if (!groupMap[category]) groupMap[category] = [];
                groupMap[category].push(permString);
            });

            const formattedPerms = Object.keys(groupMap).map(cat => ({
                category: cat,
                perms: groupMap[cat]
            }));

            setAllPermissions(formattedPerms);
            setRoles(rolesList);

            // Construct map of assigned permissions
            const newMap: Record<string, Record<string, boolean>> = {};
            rolesList.forEach((r: any) => {
                newMap[r.name] = {};
                // If API returns permissions populated on the role
                if (r.permissions && Array.isArray(r.permissions)) {
                    r.permissions.forEach((p: any) => {
                        if (typeof p === 'string') {
                            newMap[r.name][p] = true;
                        } else if (p.permission_key) {
                            newMap[r.name][p.permission_key] = true;
                        }
                    });
                }
            });
            setPermissionsMap(newMap);
        } catch (err: any) {
            setError(err.message || t('roles.errorLoading'));
        } finally {
            setIsFetching(false);
        }
    };

    const handleTogglePermission = (roleName: string, perm: string) => {
        if (roleName === 'SOAR Admin' || roleName === 'SUPER_ADMIN' || roleName === 'super_admin') {
            return alert(t('roles.cannotModifySuperAdmin'));
        }

        setPermissionsMap(prev => {
            const rolePerms = { ...prev[roleName] };
            if (rolePerms[perm]) {
                delete rolePerms[perm];
            } else {
                rolePerms[perm] = true;
            }
            return { ...prev, [roleName]: rolePerms };
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Note: API integration needed for bulk update
            // await rolesApi.updatePermissions(...)
            alert(t('roles.saveNotImplemented'));
        } catch (err: any) {
            alert(t('roles.saveFailed', { error: err.message }));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-start">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Shield className="w-8 h-8 text-soar-accent" />
                        {t('roles.title')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">{t('roles.subtitle')}</p>
                </div>
                {canManageRoles && (
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => alert('Feature coming soon')} className="gap-2">
                            <Shield className="w-4 h-4" />
                            {t('roles.newRole')}
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                            <Save className="w-4 h-4" />
                            {isSaving ? t('roles.applying') : t('roles.savePolicies')}
                        </Button>
                    </div>
                )}
            </div>

            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex gap-4 text-orange-400 items-start">
                <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-bold mb-1">{t('roles.warningTitle')}</h3>
                    <p className="text-sm">{t('roles.warningText')}</p>
                </div>
            </div>

            <div className="bg-soar-card border border-soar-border rounded-xl flex flex-col overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-start border-collapse min-w-[600px]">
                        <thead>
                            <tr className="bg-soar-bg text-slate-500 dark:text-slate-400 text-sm uppercase tracking-wider">
                                <th className="p-4 font-medium border-b border-soar-border text-start w-64">{t('roles.table.scopes')}</th>
                                {roles.map(r => (
                                    <th key={r.id} className="p-4 font-medium border-b border-soar-border text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <Shield className="w-4 h-4 text-soar-accent" />
                                            {r.name.toUpperCase()}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isFetching ? (
                                <tr><td colSpan={roles.length + 1} className="p-8 text-center text-slate-500 dark:text-slate-400">{t('roles.loading')}</td></tr>
                            ) : error ? (
                                <tr><td colSpan={roles.length + 1} className="p-8 text-center text-red-500">{error}</td></tr>
                            ) : (
                                allPermissions.map((group, gIdx) => (
                                    <React.Fragment key={gIdx}>
                                        <tr className="bg-soar-bg/50">
                                            <td colSpan={roles.length + 1} className="px-4 py-2 font-bold text-soar-accent text-sm uppercase tracking-wider border-b border-soar-border">
                                                {group.category}
                                            </td>
                                        </tr>
                                        {group.perms.map((perm: string) => (
                                            <tr key={perm} className="border-b border-soar-border/50 hover:bg-soar-bg/30">
                                                <td className="p-4 border-e border-soar-border font-mono text-sm text-slate-500 dark:text-slate-400">
                                                    {perm}
                                                </td>
                                                {roles.map((role) => {
                                                    const isAdmin = role.name === 'SUPER_ADMIN' || role.name === 'super_admin';
                                                    const hasPerm = isAdmin || permissionsMap[role.name]?.[perm];
                                                    return (
                                                        <td key={`${role.id}-${perm}`} className="p-4 text-center">
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only peer"
                                                                    checked={!!hasPerm}
                                                                    disabled={isAdmin}
                                                                    onChange={() => handleTogglePermission(role.name, perm)}
                                                                />
                                                                <div className={`w-9 h-5 rounded-full peer peer-focus:outline-none transition-colors
                                                                    ${hasPerm ? 'bg-soar-accent' : 'bg-slate-700'}
                                                                    ${isAdmin ? 'opacity-50 cursor-not-allowed' : ''}
                                                                    after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all
                                                                    ${hasPerm ? 'after:translate-x-full rtl:after:-translate-x-full' : ''}
                                                                `}></div>
                                                            </label>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
