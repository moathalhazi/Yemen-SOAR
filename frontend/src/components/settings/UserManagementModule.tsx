'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Users, Search, Plus, Shield, MoreVertical, Eye, Pencil, KeyRound,
    Trash2, Power, PowerOff, UserCheck, UserX, Loader2, X, Check,
    ChevronDown, AlertTriangle, Mail, Phone, Building, Clock, Calendar,
    Fingerprint
} from 'lucide-react';
import { Button, Input, Modal } from '@/components/ui';
import { usersApi, rolesApi } from '@/lib/api';
import type { User } from '@/types';
import { useAuthStore, hasPermission } from '@/stores';
import { useTranslationStore } from '@/stores/i18nStore';
import { cn } from '@/lib/utils';

// ─── Dropdown Menu ───────────────────────────────────────────────────────────
function ActionDropdown({
    user, onView, onEdit, onResetPassword, onToggleStatus, onDelete, t
}: {
    user: User;
    onView: () => void;
    onEdit: () => void;
    onResetPassword: () => void;
    onToggleStatus: () => void;
    onDelete: () => void;
    t: (key: string) => string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const items = [
        { icon: Eye, label: t('userManagement.actions.viewProfile'), action: onView, color: 'text-blue-500' },
        { icon: Pencil, label: t('userManagement.actions.editUser'), action: onEdit, color: 'text-amber-500' },
        { icon: KeyRound, label: t('userManagement.actions.resetPassword'), action: onResetPassword, color: 'text-purple-500' },
        {
            icon: user.is_active ? PowerOff : Power,
            label: user.is_active ? t('userManagement.actions.disableAccount') : t('userManagement.actions.enableAccount'),
            action: onToggleStatus,
            color: user.is_active ? 'text-orange-500' : 'text-emerald-500',
        },
        { icon: Trash2, label: t('userManagement.actions.deleteUser'), action: onDelete, color: 'text-red-500', divider: true },
    ];

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-soar-card hover:text-slate-900 dark:hover:text-white transition-colors"
            >
                <MoreVertical className="w-4 h-4" />
            </button>
            {open && (
                <div className="absolute end-0 top-full mt-1 w-56 bg-soar-bg-secondary border border-soar-border rounded-xl shadow-2xl z-50 py-1.5 animate-fade-in">
                    {items.map((item, i) => (
                        <div key={i}>
                            {item.divider && <div className="border-t border-soar-border my-1" />}
                            <button
                                onClick={() => { item.action(); setOpen(false); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-soar-card transition-colors"
                            >
                                <item.icon className={cn('w-4 h-4', item.color)} />
                                {item.label}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Role Badge ──────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
    const normalizedRole = role.toLowerCase().replace(/_/g, ' ');
    const colors: Record<string, string> = {
        'super admin': 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
        'administrator': 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
        'admin': 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
        'soc analyst': 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
        'incident manager': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
        'auditor': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    };
    const colorClass = colors[normalizedRole] || 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30';

    return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', colorClass)}>
            <Shield className="w-3 h-3" />
            {role}
        </span>
    );
}

// =============================================================================
// Main Component
// =============================================================================
export default function UserManagementModule() {
    const { t } = useTranslationStore();
    const { user: currentUser } = useAuthStore();
    const canManageUsers = hasPermission(currentUser, 'users.manage');

    // Data
    const [users, setUsers] = useState<User[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [availableRoles, setAvailableRoles] = useState<any[]>([]);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Modals
    const [viewUser, setViewUser] = useState<User | null>(null);
    const [editUser, setEditUser] = useState<User | null>(null);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [deleteUser, setDeleteUser] = useState<User | null>(null);
    const [resetUser, setResetUser] = useState<User | null>(null);

    // Form state
    const [editForm, setEditForm] = useState<Record<string, any>>({});
    const [inviteForm, setInviteForm] = useState<Record<string, string>>({});
    const [newPassword, setNewPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // ─── Fetch ───────────────────────────────────────────────────────────────
    useEffect(() => { fetchUsers(); fetchRoles(); }, []);

    const fetchUsers = async () => {
        setIsFetching(true);
        setError(null);
        try {
            const data = await usersApi.getAll();
            setUsers(Array.isArray(data) ? data : (data as any)?.items || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load users.');
        } finally {
            setIsFetching(false);
        }
    };

    const fetchRoles = async () => {
        try {
            const data = await rolesApi.getAll();
            const roles = Array.isArray(data) ? data : (data as any)?.items || [];
            setAvailableRoles(roles);
        } catch { /* silent */ }
    };

    // ─── Filtering ───────────────────────────────────────────────────────────
    const filteredUsers = users.filter(u => {
        const displayName = u.full_name || u.username;
        const roleNames = u.roles?.map(r => typeof r === 'string' ? r : r.name).join(' ') || '';
        const matchSearch = !searchTerm ||
            displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            roleNames.toLowerCase().includes(searchTerm.toLowerCase());
        const matchRole = !roleFilter || roleNames.toLowerCase().includes(roleFilter.toLowerCase());
        const matchStatus = !statusFilter ||
            (statusFilter === 'active' && u.is_active) ||
            (statusFilter === 'disabled' && !u.is_active);
        return matchSearch && matchRole && matchStatus;
    });

    const activeCount = users.filter(u => u.is_active).length;
    const disabledCount = users.filter(u => !u.is_active).length;

    // ─── Unique roles for filter ─────────────────────────────────────────────
    const uniqueRoles = Array.from(new Set(users.flatMap(u =>
        u.roles?.map(r => typeof r === 'string' ? r : r.name) || []
    )));

    // ─── Actions ─────────────────────────────────────────────────────────────
    const handleToggleStatus = async (user: User) => {
        try {
            await usersApi.update(user.id, { is_active: !user.is_active });
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !user.is_active } : u));
            showSuccess(t('userManagement.notifications.statusChanged'));
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteUser) return;
        setIsSaving(true);
        try {
            await usersApi.delete(deleteUser.id);
            setUsers(prev => prev.filter(u => u.id !== deleteUser.id));
            setDeleteUser(null);
            showSuccess(t('userManagement.notifications.userDeleted'));
        } catch (err: any) {
            // If endpoint doesn't exist, soft-delete via update
            try {
                await usersApi.update(deleteUser.id, { is_active: false });
                setUsers(prev => prev.map(u => u.id === deleteUser.id ? { ...u, is_active: false } : u));
                setDeleteUser(null);
                showSuccess(t('userManagement.notifications.userDeleted'));
            } catch {
                alert(`Error: ${err.message}`);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetConfirm = async () => {
        if (!resetUser || !newPassword) return;
        setIsSaving(true);
        try {
            await usersApi.resetPassword(resetUser.id, newPassword);
            setResetUser(null);
            setNewPassword('');
            showSuccess(t('userManagement.notifications.passwordReset'));
        } catch (err: any) {
            // Fallback: try update with password field
            try {
                await usersApi.update(resetUser.id, { password: newPassword });
                setResetUser(null);
                setNewPassword('');
                showSuccess(t('userManagement.notifications.passwordReset'));
            } catch {
                alert(`Error: ${err.message}`);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const openEdit = (user: User) => {
        setEditForm({
            full_name: user.full_name || '',
            email: user.email,
            phone: user.phone || '',
            department: user.department || '',
            is_active: user.is_active,
            role: user.roles?.[0] ? (typeof user.roles[0] === 'string' ? user.roles[0] : user.roles[0].name) : '',
        });
        setEditUser(user);
    };

    const handleEditSave = async () => {
        if (!editUser) return;
        setIsSaving(true);
        try {
            const role_id = availableRoles.find(r => (r.name || r) === editForm.role)?.id;
            const payload: any = { ...editForm };
            if (role_id) payload.role_ids = [role_id];
            delete payload.role;

            await usersApi.update(editUser.id, payload);
            setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...editForm } : u));
            setEditUser(null);
            showSuccess(t('userManagement.notifications.userUpdated'));
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleInvite = async () => {
        setIsSaving(true);
        try {
            const selectedRoleName = inviteForm.role || 'SOC Analyst';
            const role_id = availableRoles.find(r => (r.name || r) === selectedRoleName)?.id;

            const payload = {
                username: inviteForm.username,
                email: inviteForm.email,
                full_name: inviteForm.full_name || inviteForm.username,
                password: inviteForm.password,
                role_ids: role_id ? [role_id] : [],
            };
            const result = await usersApi.create(payload);
            await fetchUsers();
            setInviteOpen(false);
            setInviteForm({});
            showSuccess(t('userManagement.notifications.userCreated'));
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const showSuccess = (msg: string) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 4000);
    };

    // ─── Helpers ─────────────────────────────────────────────────────────────
    const getRole = (u: User) => u.roles?.[0] ? (typeof u.roles[0] === 'string' ? u.roles[0] : u.roles[0].name) : 'User';
    const getAvatar = (u: User) => {
        if (!u.avatar_url) return null;
        if (u.avatar_url.startsWith('http')) return u.avatar_url;
        return `http://localhost:8000${u.avatar_url}`;
    };
    const getInitials = (u: User) => (u.full_name || u.username).charAt(0).toUpperCase();

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-start">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3 text-slate-900 dark:text-white">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-soar-accent to-blue-600 flex items-center justify-center">
                            <Users className="w-5 h-5 text-white" />
                        </div>
                        {t('userManagement.title')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">{t('userManagement.subtitle')}</p>
                </div>
                {canManageUsers && (
                    <Button onClick={() => setInviteOpen(true)} className="gap-2">
                        <Plus className="w-4 h-4" />
                        {t('userManagement.inviteUser')}
                    </Button>
                )}
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-soar-card border border-soar-border rounded-lg">
                    <Users className="w-4 h-4 text-soar-accent" />
                    <span className="text-slate-600 dark:text-slate-400">{t('userManagement.totalUsers')}:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{users.length}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-soar-card border border-soar-border rounded-lg">
                    <UserCheck className="w-4 h-4 text-emerald-500" />
                    <span className="text-slate-600 dark:text-slate-400">{t('userManagement.activeUsers')}:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-soar-card border border-soar-border rounded-lg">
                    <UserX className="w-4 h-4 text-red-500" />
                    <span className="text-slate-600 dark:text-slate-400">{t('userManagement.disabledUsers')}:</span>
                    <span className="font-bold text-red-600 dark:text-red-400">{disabledCount}</span>
                </div>
            </div>

            {/* Success Banner */}
            {
                successMsg && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-emerald-600 dark:text-emerald-400 flex items-center gap-2 animate-fade-in">
                        <Check className="w-4 h-4" />
                        <span className="text-sm font-medium">{successMsg}</span>
                        <button className="ms-auto" onClick={() => setSuccessMsg(null)}><X className="w-4 h-4" /></button>
                    </div>
                )
            }

            {/* Table Card */}
            <div className="bg-soar-card border border-soar-border rounded-xl flex flex-col">
                {/* Toolbar */}
                <div className="p-4 border-b border-soar-border flex flex-col md:flex-row items-start md:items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder={t('userManagement.searchPlaceholder')}
                            className="ps-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={roleFilter}
                            onChange={e => setRoleFilter(e.target.value)}
                            className="px-3 py-2 bg-soar-bg-secondary border border-soar-border rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-soar-accent"
                        >
                            <option value="">{t('userManagement.filters.allRoles')}</option>
                            {uniqueRoles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="px-3 py-2 bg-soar-bg-secondary border border-soar-border rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-soar-accent"
                        >
                            <option value="">{t('userManagement.filters.allStatuses')}</option>
                            <option value="active">{t('userManagement.status.active')}</option>
                            <option value="disabled">{t('userManagement.status.suspended')}</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-start border-collapse">
                        <thead>
                            <tr className="bg-soar-bg text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                                <th className="p-4 font-semibold border-b border-soar-border text-start">{t('userManagement.table.user')}</th>
                                <th className="p-4 font-semibold border-b border-soar-border text-start">{t('userManagement.table.role')}</th>
                                <th className="p-4 font-semibold border-b border-soar-border text-start">{t('userManagement.table.status')}</th>
                                <th className="p-4 font-semibold border-b border-soar-border text-start">{t('userManagement.table.lastLogin')}</th>
                                <th className="p-4 font-semibold border-b border-soar-border text-end w-16">{t('userManagement.table.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isFetching ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <div className="flex items-center justify-center gap-3 text-slate-500">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            {t('userManagement.notifications.loading')}
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-red-500">
                                        <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
                                        {error}
                                    </td>
                                </tr>
                            ) : filteredUsers.map(u => {
                                const displayName = u.full_name || u.username;
                                const primaryRole = getRole(u);
                                const avatarUrl = getAvatar(u);

                                return (
                                    <tr
                                        key={u.id}
                                        className="border-b border-soar-border/50 hover:bg-soar-bg/50 transition-colors cursor-pointer"
                                        onClick={() => setViewUser(u)}
                                    >
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                {avatarUrl ? (
                                                    <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-soar-border" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-soar-accent/20 to-blue-500/20 border-2 border-soar-accent/30 flex items-center justify-center font-bold text-soar-accent text-sm">
                                                        {getInitials(u)}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-semibold text-slate-900 dark:text-white">{displayName}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <RoleBadge role={primaryRole} />
                                        </td>
                                        <td className="p-4">
                                            <span className={cn(
                                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
                                                u.is_active
                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                                    : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                                            )}>
                                                <span className={cn('w-2 h-2 rounded-full', u.is_active ? 'bg-emerald-500' : 'bg-red-500')} />
                                                {u.is_active ? t('userManagement.status.active') : t('userManagement.status.suspended')}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-slate-500 dark:text-slate-400">
                                            {u.last_login ? new Date(u.last_login).toLocaleDateString() : t('integrations.never')}
                                        </td>
                                        <td className="p-4 text-end" onClick={e => e.stopPropagation()}>
                                            {canManageUsers ? (
                                                <ActionDropdown
                                                    user={u}
                                                    t={t}
                                                    onView={() => setViewUser(u)}
                                                    onEdit={() => openEdit(u)}
                                                    onResetPassword={() => { setResetUser(u); setNewPassword(''); }}
                                                    onToggleStatus={() => handleToggleStatus(u)}
                                                    onDelete={() => setDeleteUser(u)}
                                                />
                                            ) : (
                                                <span className="text-xs text-slate-500 italic">{t('userManagement.actions.noAccess')}</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {!isFetching && !error && filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-slate-500 dark:text-slate-400">
                                        <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                        {t('userManagement.notifications.noUsers')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ═══ View Profile Modal ═══ */}
            <Modal
                isOpen={!!viewUser}
                onClose={() => setViewUser(null)}
                title={t('userManagement.modal.viewTitle')}
                size="lg"
                footer={
                    <div className="flex gap-2">
                        {canManageUsers && viewUser && (
                            <>
                                <Button variant="secondary" onClick={() => { openEdit(viewUser); setViewUser(null); }}>
                                    <Pencil className="w-4 h-4 me-2" />{t('userManagement.actions.editUser')}
                                </Button>
                                <Button variant="secondary" onClick={() => { setResetUser(viewUser); setNewPassword(''); setViewUser(null); }}>
                                    <KeyRound className="w-4 h-4 me-2" />{t('userManagement.actions.resetPassword')}
                                </Button>
                            </>
                        )}
                        <Button variant="secondary" onClick={() => setViewUser(null)}>
                            {t('userManagement.modal.close')}
                        </Button>
                    </div>
                }
            >
                {viewUser && (
                    <div className="space-y-5">
                        {/* Profile Header */}
                        <div className="flex items-center gap-4 p-4 bg-soar-bg-secondary rounded-xl border border-soar-border">
                            {getAvatar(viewUser) ? (
                                <img src={getAvatar(viewUser)!} alt="" className="w-16 h-16 rounded-full border-2 border-soar-border" />
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-soar-accent/20 to-blue-500/20 border-2 border-soar-accent/30 flex items-center justify-center font-bold text-soar-accent text-2xl">
                                    {getInitials(viewUser)}
                                </div>
                            )}
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{viewUser.full_name || viewUser.username}</h3>
                                <p className="text-sm text-slate-500">@{viewUser.username}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <RoleBadge role={getRole(viewUser)} />
                                    <span className={cn(
                                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
                                        viewUser.is_active
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                            : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                                    )}>
                                        <span className={cn('w-1.5 h-1.5 rounded-full', viewUser.is_active ? 'bg-emerald-500' : 'bg-red-500')} />
                                        {viewUser.is_active ? t('userManagement.status.active') : t('userManagement.status.suspended')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { icon: Mail, label: t('userManagement.fields.email'), value: viewUser.email },
                                { icon: Phone, label: t('userManagement.fields.phone'), value: viewUser.phone || '—' },
                                { icon: Building, label: t('userManagement.fields.department'), value: viewUser.department || '—' },
                                { icon: Calendar, label: t('userManagement.fields.createdAt'), value: new Date(viewUser.created_at).toLocaleDateString() },
                                { icon: Clock, label: t('userManagement.fields.lastLogin'), value: viewUser.last_login ? new Date(viewUser.last_login).toLocaleString() : '—' },
                                { icon: Fingerprint, label: t('userManagement.fields.mfaEnabled'), value: viewUser.mfa_enabled ? '✓' : '✗' },
                                { icon: Users, label: t('userManagement.fields.loginCount'), value: String(viewUser.login_count ?? '—') },
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-3 p-3 bg-soar-bg-secondary rounded-lg border border-soar-border">
                                    <item.icon className="w-4 h-4 text-soar-accent mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs text-slate-500">{item.label}</p>
                                        <p className="text-sm font-medium text-slate-900 dark:text-white">{item.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Permissions */}
                        {viewUser.permissions && viewUser.permissions.length > 0 && (
                            <div>
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{t('userManagement.fields.permissions')}</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {viewUser.permissions.map(p => (
                                        <span key={p} className="px-2 py-0.5 bg-soar-bg-secondary border border-soar-border rounded text-xs text-slate-600 dark:text-slate-400 font-mono">
                                            {p}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* ═══ Edit User Modal ═══ */}
            <Modal
                isOpen={!!editUser}
                onClose={() => setEditUser(null)}
                title={t('userManagement.modal.editTitle')}
                size="md"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setEditUser(null)}>{t('userManagement.modal.cancel')}</Button>
                        <Button onClick={handleEditSave} disabled={isSaving}>
                            {isSaving ? <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t('userManagement.modal.saving')}</> : t('userManagement.modal.save')}
                        </Button>
                    </>
                }
            >
                {editUser && (
                    <div className="space-y-4">
                        {[
                            { key: 'full_name', label: t('userManagement.fields.fullName'), placeholder: t('userManagement.fields.fullNamePlaceholder'), type: 'text' },
                            { key: 'email', label: t('userManagement.fields.email'), placeholder: t('userManagement.fields.emailPlaceholder'), type: 'email' },
                            { key: 'phone', label: t('userManagement.fields.phone'), placeholder: t('userManagement.fields.phonePlaceholder'), type: 'text' },
                            { key: 'department', label: t('userManagement.fields.department'), placeholder: t('userManagement.fields.departmentPlaceholder'), type: 'text' },
                        ].map(field => (
                            <div key={field.key}>
                                <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">{field.label}</label>
                                <input
                                    type={field.type}
                                    placeholder={field.placeholder}
                                    value={editForm[field.key] || ''}
                                    onChange={e => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-soar-bg-secondary border border-soar-border rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-soar-accent"
                                />
                            </div>
                        ))}
                        {/* Role selector */}
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">{t('userManagement.fields.role')}</label>
                            <select
                                value={editForm.role || ''}
                                onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                                className="w-full px-3 py-2.5 bg-soar-bg-secondary border border-soar-border rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-soar-accent"
                            >
                                {availableRoles.map(r => <option key={r.id || r.name || r} value={r.name || r}>{r.name || r}</option>)}
                            </select>
                        </div>
                        {/* Status toggle */}
                        <div className="flex items-center justify-between p-3 bg-soar-bg-secondary rounded-lg border border-soar-border">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('userManagement.fields.accountStatus')}</span>
                            <button
                                onClick={() => setEditForm(prev => ({ ...prev, is_active: !prev.is_active }))}
                                className={cn(
                                    'relative w-11 h-6 rounded-full transition-colors',
                                    editForm.is_active ? 'bg-emerald-500' : 'bg-slate-400'
                                )}
                            >
                                <span className={cn(
                                    'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                                    editForm.is_active ? 'start-5' : 'start-0.5'
                                )} />
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ═══ Invite User Modal ═══ */}
            <Modal
                isOpen={inviteOpen}
                onClose={() => setInviteOpen(false)}
                title={t('userManagement.modal.inviteTitle')}
                size="md"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setInviteOpen(false)}>{t('userManagement.modal.cancel')}</Button>
                        <Button onClick={handleInvite} disabled={isSaving || !inviteForm.username || !inviteForm.email || !inviteForm.password}>
                            {isSaving ? <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t('userManagement.modal.creating')}</> : <><Plus className="w-4 h-4 me-2" />{t('userManagement.modal.create')}</>}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    {[
                        { key: 'full_name', label: t('userManagement.fields.fullName'), placeholder: t('userManagement.fields.fullNamePlaceholder'), type: 'text', required: true },
                        { key: 'username', label: t('userManagement.fields.username'), placeholder: t('userManagement.fields.usernamePlaceholder'), type: 'text', required: true },
                        { key: 'email', label: t('userManagement.fields.email'), placeholder: t('userManagement.fields.emailPlaceholder'), type: 'email', required: true },
                        { key: 'password', label: t('userManagement.fields.password'), placeholder: t('userManagement.fields.passwordPlaceholder'), type: 'password', required: true },
                        { key: 'phone', label: t('userManagement.fields.phone'), placeholder: t('userManagement.fields.phonePlaceholder'), type: 'text' },
                        { key: 'department', label: t('userManagement.fields.department'), placeholder: t('userManagement.fields.departmentPlaceholder'), type: 'text' },
                    ].map(field => (
                        <div key={field.key}>
                            <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
                                {field.label} {(field as any).required && <span className="text-red-500">*</span>}
                            </label>
                            <input
                                type={field.type}
                                placeholder={field.placeholder}
                                value={inviteForm[field.key] || ''}
                                onChange={e => setInviteForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                                className="w-full px-3 py-2.5 bg-soar-bg-secondary border border-soar-border rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-soar-accent"
                            />
                        </div>
                    ))}
                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">{t('userManagement.fields.role')}</label>
                        <select
                            value={inviteForm.role || ''}
                            onChange={e => setInviteForm(prev => ({ ...prev, role: e.target.value }))}
                            className="w-full px-3 py-2.5 bg-soar-bg-secondary border border-soar-border rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-soar-accent"
                        >
                            <option value="">Select role...</option>
                            {availableRoles.map(r => <option key={r.id || r.name || r} value={r.name || r}>{r.name || r}</option>)}
                        </select>
                    </div>
                </div>
            </Modal>

            {/* ═══ Delete Confirmation Modal ═══ */}
            <Modal
                isOpen={!!deleteUser}
                onClose={() => setDeleteUser(null)}
                title={t('userManagement.modal.deleteTitle')}
                size="sm"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setDeleteUser(null)}>{t('userManagement.modal.cancel')}</Button>
                        <Button onClick={handleDeleteConfirm} disabled={isSaving} className="bg-red-500 hover:bg-red-600 text-white border-red-500">
                            {isSaving ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Trash2 className="w-4 h-4 me-2" />}
                            {t('userManagement.actions.deleteUser')}
                        </Button>
                    </>
                }
            >
                {deleteUser && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
                            <p className="text-sm text-red-600 dark:text-red-400">{t('userManagement.modal.confirmDelete')}</p>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-soar-bg-secondary rounded-lg border border-soar-border">
                            <div className="w-10 h-10 rounded-full bg-soar-accent/10 border border-soar-accent/30 flex items-center justify-center font-bold text-soar-accent text-sm">
                                {getInitials(deleteUser)}
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900 dark:text-white">{deleteUser.full_name || deleteUser.username}</p>
                                <p className="text-xs text-slate-500">{deleteUser.email}</p>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ═══ Reset Password Modal ═══ */}
            <Modal
                isOpen={!!resetUser}
                onClose={() => setResetUser(null)}
                title={t('userManagement.modal.resetTitle')}
                size="sm"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setResetUser(null)}>{t('userManagement.modal.cancel')}</Button>
                        <Button onClick={handleResetConfirm} disabled={isSaving || newPassword.length < 8}>
                            {isSaving ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <KeyRound className="w-4 h-4 me-2" />}
                            {t('userManagement.modal.confirm')}
                        </Button>
                    </>
                }
            >
                {resetUser && (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400">{t('userManagement.modal.confirmReset')}</p>
                        <div className="flex items-center gap-3 p-3 bg-soar-bg-secondary rounded-lg border border-soar-border">
                            <div className="w-10 h-10 rounded-full bg-soar-accent/10 border border-soar-accent/30 flex items-center justify-center font-bold text-soar-accent text-sm">
                                {getInitials(resetUser)}
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900 dark:text-white">{resetUser.full_name || resetUser.username}</p>
                                <p className="text-xs text-slate-500">{resetUser.email}</p>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">{t('userManagement.modal.newPassword')}</label>
                            <input
                                type="password"
                                placeholder={t('userManagement.modal.newPasswordPlaceholder')}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="w-full px-3 py-2.5 bg-soar-bg-secondary border border-soar-border rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-soar-accent"
                            />
                        </div>
                    </div>
                )}
            </Modal>
        </div >
    );
}
