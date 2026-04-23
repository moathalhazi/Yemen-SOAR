'use client';

import { ReactNode } from 'react';
import { useAuthStore } from '@/stores';

interface PermissionGuardProps {
    permissions: string | string[];
    requireAll?: boolean;
    children: ReactNode;
    fallback?: ReactNode;
}

export function PermissionGuard({
    permissions,
    requireAll = false,
    children,
    fallback = null,
}: PermissionGuardProps) {
    const { user } = useAuthStore();

    // If not logged in, deny access
    if (!user) return <>{fallback}</>;

    // Super Admin or Administrator bypass
    const getRoleName = (role: { name: string } | string) => typeof role === 'string' ? role : role.name;
    const adminRoleAliases = new Set(['SUPER_ADMIN', 'super_admin', 'Administrator', 'soar_admin']);
    const isSuperAdmin = user.roles.some((role) => adminRoleAliases.has(getRoleName(role)));
    if (isSuperAdmin) return <>{children}</>;

    // Normalize input to array
    const requiredPermissions = (Array.isArray(permissions) ? permissions : [permissions]).map((permission) =>
        permission.replace(':', '.')
    );

    // Check permissions
    // Note: user.permissions might be undefined if not yet refreshed after backend update
    // Fallback to empty array
    const userPermissions = (user.permissions || []).map((permission) => permission.replace(':', '.'));

    const hasPermission = requireAll
        ? requiredPermissions.every(p => userPermissions.includes(p))
        : requiredPermissions.some(p => userPermissions.includes(p));

    if (hasPermission) {
        return <>{children}</>;
    }

    return <>{fallback}</>;
}
