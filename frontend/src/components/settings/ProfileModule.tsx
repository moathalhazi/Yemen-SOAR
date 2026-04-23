import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/stores';
import { Building, Mail, Phone, Shield, User as UserIcon, Camera, Key, Activity, Calendar, Fingerprint, Users, Clock, Loader2, Save, X, Trash2 } from 'lucide-react';
import { Button, Input, Label } from '@/components/ui';
import { usersApi } from '@/lib/api';
import { useTranslationStore } from '@/stores/i18nStore';
import { cn } from '@/lib/utils';

export default function ProfileModule() {
    const { t } = useTranslationStore();
    const { user, token, setAuth } = useAuthStore();
    const [isEditing, setIsEditing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Password change state
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    const safeUser: any = user || {};

    const [formData, setFormData] = useState({
        full_name: safeUser.full_name || '',
        email: safeUser.email || '',
        phone: safeUser.phone || '',
        department: safeUser.department || '',
    });

    useEffect(() => {
        setFormData({
            full_name: safeUser.full_name || '',
            email: safeUser.email || '',
            phone: safeUser.phone || '',
            department: safeUser.department || '',
        });
    }, [safeUser.full_name, safeUser.email, safeUser.phone, safeUser.department]);

    const getAvatar = () => {
        if (!safeUser.avatar_url) return null;
        if (safeUser.avatar_url.startsWith('http')) return safeUser.avatar_url;
        return `http://localhost:8000${safeUser.avatar_url}`;
    };

    // Check if form data has been modified
    const isDirty = formData.full_name !== (safeUser.full_name || '') ||
        formData.email !== (safeUser.email || '') ||
        formData.phone !== (safeUser.phone || '') ||
        formData.department !== (safeUser.department || '');

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !safeUser?.id) return;

        try {
            setIsUploading(true);
            const updatedUser = await usersApi.uploadAvatar(safeUser.id, file);
            if (token) setAuth({ ...safeUser, ...updatedUser }, token);
            window.location.reload();
        } catch (error) {
            console.error('Failed to upload avatar:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteAvatar = async () => {
        if (!safeUser?.id || !safeUser.avatar_url) return;
        try {
            setIsDeletingAvatar(true);
            await usersApi.deleteAvatar(safeUser.id);
            if (token) setAuth({ ...safeUser, avatar_url: null }, token);
            window.location.reload();
        } catch (error) {
            console.error('Failed to delete avatar:', error);
        } finally {
            setIsDeletingAvatar(false);
        }
    };

    const handleSave = async () => {
        if (!safeUser?.id) return;

        try {
            setIsSaving(true);
            const updatedUser = await usersApi.update(safeUser.id, formData);
            if (token) setAuth({ ...safeUser, ...(updatedUser || {}) }, token);
            setIsEditing(false);
            window.location.reload();
        } catch (error) {
            console.error('Failed to update profile:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setFormData({
            full_name: safeUser.full_name || '',
            email: safeUser.email || '',
            phone: safeUser.phone || '',
            department: safeUser.department || '',
        });
        setIsEditing(false);
    };

    const handleChangePassword = async () => {
        if (!safeUser?.id || newPassword.length < 8) return;

        try {
            setIsChangingPassword(true);
            await usersApi.update(safeUser.id, { password: newPassword });
            setIsPasswordModalOpen(false);
            setNewPassword('');
            // Optional: trigger local success state
        } catch (error) {
            console.error('Failed to update password:', error);
        } finally {
            setIsChangingPassword(false);
        }
    };

    const getInitials = (name: string) => {
        if (!name) return 'U';
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    const getRole = (roles: any[]) => {
        if (!roles || roles.length === 0) return 'User';
        const role = roles[0];
        return typeof role === 'string' ? role : role.name;
    };

    return (
        <div className="relative animate-in fade-in duration-500 pb-12">
            {/* Sticky Save Header when editing */}
            {isEditing && (
                <div className="sticky top-0 z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-6 bg-soar-bg-secondary/95 backdrop-blur border-b border-soar-border flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-sm font-medium text-amber-600 dark:text-amber-500">
                            {t('profile.unsavedChanges') || 'You have unsaved changes'}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Button variant="secondary" onClick={handleCancel} disabled={isSaving} className="flex-1 sm:flex-none">
                            <X className="w-4 h-4 me-2" />
                            {t('profile.cancelChanges') || 'Cancel'}
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving || !isDirty} className="flex-1 sm:flex-none">
                            {isSaving ? <><Loader2 className="w-4 h-4 me-2 animate-spin" /> {t('profile.saving')}</> : <><Save className="w-4 h-4 me-2" /> {t('profile.saveChanges')}</>}
                        </Button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* ─── LEFT COLUMN (2/3 width) ─── */}
                <div className="xl:col-span-2 space-y-6">

                    {/* User Overview Profile Card */}
                    <div className="bg-soar-card border border-soar-border rounded-xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 start-0 w-full h-32 bg-gradient-to-r from-soar-accent/20 to-transparent rtl:bg-gradient-to-l" />

                        <div className="relative pt-12 flex flex-col sm:flex-row items-center sm:items-end gap-6 text-center sm:text-start">
                            <div className="relative group shrink-0">
                                <div className="w-32 h-32 rounded-full border-4 border-soar-card shadow-xl ring-2 ring-soar-accent/20 overflow-hidden flex items-center justify-center bg-gradient-to-br from-soar-accent/20 to-blue-500/20 text-4xl text-soar-accent font-bold">
                                    {getAvatar() ? (
                                        <img src={getAvatar()!} alt={safeUser.username} className="w-full h-full object-cover" />
                                    ) : (
                                        getInitials(safeUser.full_name || safeUser.username)
                                    )}
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />

                                {/* Upload Action for Avatar - Always visible */}
                                <button
                                    onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
                                    disabled={isUploading}
                                    className="absolute bottom-0 end-0 p-2.5 bg-soar-bg-secondary border border-soar-border hover:bg-soar-card text-soar-accent rounded-full shadow-lg transition-colors z-10"
                                    title={t('profile.uploadAvatar')}
                                >
                                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                                </button>

                                {/* Delete Action for Avatar */}
                                {safeUser.avatar_url && (
                                    <button
                                        onClick={handleDeleteAvatar}
                                        disabled={isDeletingAvatar}
                                        className="absolute top-0 end-0 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors z-10"
                                        title={t('profile.deleteAvatar') || 'Delete avatar'}
                                    >
                                        {isDeletingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 pb-2">
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{safeUser.full_name || safeUser.username}</h2>
                                <p className="text-slate-500 mb-3">@{safeUser.username}</p>
                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-soar-accent/10 border border-soar-accent/20 text-soar-accent text-sm font-medium">
                                        <Shield className="w-4 h-4" />
                                        {getRole(safeUser.roles)}
                                    </span>
                                    <span className={cn(
                                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border',
                                        safeUser.is_active !== false
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                            : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                                    )}>
                                        <span className={cn('w-2 h-2 rounded-full', safeUser.is_active !== false ? 'bg-emerald-500' : 'bg-red-500')} />
                                        {safeUser.is_active !== false ? t('userManagement.status.active') : t('userManagement.status.suspended')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Personal Information Setup */}
                    <div className="bg-soar-card border border-soar-border rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-soar-border bg-soar-bg-secondary/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <UserIcon className="w-5 h-5 text-soar-accent" />
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('profile.personalInfo')}</h3>
                            </div>

                            {!isEditing && (
                                <Button onClick={() => setIsEditing(true)} className="shadow-sm">
                                    <UserIcon className="w-4 h-4 me-2" />
                                    {t('profile.editProfile')}
                                </Button>
                            )}
                        </div>

                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 text-start">
                                <div className="space-y-2">
                                    <Label>{t('profile.fields.fullName')}</Label>
                                    <Input
                                        value={isEditing ? formData.full_name : (safeUser.full_name || '—')}
                                        onChange={(e: any) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                                        disabled={!isEditing}
                                        icon={<UserIcon className="w-4 h-4" />}
                                        className={!isEditing ? "bg-soar-bg-secondary border-transparent" : ""}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('profile.fields.email')}</Label>
                                    <Input
                                        value={isEditing ? formData.email : (safeUser.email || '—')}
                                        onChange={(e: any) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                        disabled={!isEditing}
                                        icon={<Mail className="w-4 h-4" />}
                                        className={!isEditing ? "bg-soar-bg-secondary border-transparent" : ""}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('profile.fields.phone')}</Label>
                                    <Input
                                        value={isEditing ? formData.phone : (safeUser.phone || '—')}
                                        onChange={(e: any) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        disabled={!isEditing}
                                        icon={<Phone className="w-4 h-4" />}
                                        className={!isEditing ? "bg-soar-bg-secondary border-transparent" : ""}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('profile.fields.department')}</Label>
                                    <Input
                                        value={isEditing ? formData.department : (safeUser.department || '—')}
                                        onChange={(e: any) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                                        disabled={!isEditing}
                                        icon={<Building className="w-4 h-4" />}
                                        className={!isEditing ? "bg-soar-bg-secondary border-transparent" : ""}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Security Settings Area */}
                    <div className="bg-soar-card border border-soar-border rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-soar-border bg-soar-bg-secondary/50 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-soar-accent" />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('profile.security.title')}</h3>
                        </div>

                        <div className="p-6 text-start">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-soar-bg-secondary rounded-lg border border-soar-border hover:border-soar-accent/50 transition-colors">
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                        <Key className="w-4 h-4 text-slate-500" />
                                        {t('profile.security.password')}
                                    </p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('profile.security.passwordDesc')}</p>
                                </div>
                                <Button
                                    variant="secondary"
                                    onClick={(e: any) => { e.preventDefault(); setIsPasswordModalOpen(true); }}
                                    className="shrink-0"
                                >
                                    {t('profile.security.changePassword')}
                                </Button>
                            </div>

                            {/* Two Factor Auth Placeholder - Example of extending settings */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 mt-4 bg-soar-bg-secondary rounded-lg border border-soar-border opacity-70">
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                        <Fingerprint className="w-4 h-4 text-slate-500" />
                                        Two-Factor Authentication (2FA)
                                    </p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Add an extra layer of security to your account.</p>
                                </div>
                                <Button variant="secondary" disabled className="shrink-0">
                                    Configure 2FA
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── RIGHT COLUMN (1/3 width) ─── */}
                <div className="space-y-6">

                    {/* Activity Stats */}
                    <div className="bg-soar-card border border-soar-border rounded-xl overflow-hidden text-start">
                        <div className="px-6 py-4 border-b border-soar-border bg-soar-bg-secondary/50 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-soar-accent" />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('profile.activityStats')}</h3>
                        </div>

                        <div className="p-6 p-0 divide-y divide-soar-border">
                            <div className="flex justify-between items-center p-4 hover:bg-soar-bg-secondary/50 transition-colors">
                                <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                    <Activity className="w-4 h-4" /> {t('profile.incidentsResolved')}
                                </span>
                                <span className="font-bold text-lg text-emerald-500 dark:text-emerald-400">{safeUser.incidents_resolved || 0}</span>
                            </div>
                            <div className="flex justify-between items-center p-4 hover:bg-soar-bg-secondary/50 transition-colors">
                                <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                    <Shield className="w-4 h-4" /> {t('profile.playbooksAuthored')}
                                </span>
                                <span className="font-bold text-lg text-soar-accent">{safeUser.playbooks_authored || 0}</span>
                            </div>
                            <div className="flex justify-between items-center p-4 hover:bg-soar-bg-secondary/50 transition-colors">
                                <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                    <Users className="w-4 h-4" /> {t('profile.totalLogins')}
                                </span>
                                <span className="font-medium text-slate-900 dark:text-slate-200">{safeUser.login_count || 0}</span>
                            </div>
                            <div className="p-4 bg-soar-bg-secondary/30">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {t('profile.lastLogin')}</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                                    {safeUser.last_login ? new Date(safeUser.last_login).toLocaleString() : 'N/A'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Permissions & Access */}
                    <div className="bg-soar-card border border-soar-border rounded-xl overflow-hidden text-start">
                        <div className="px-6 py-4 border-b border-soar-border bg-soar-bg-secondary/50 flex items-center gap-2">
                            <Key className="w-5 h-5 text-soar-accent" />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Access Permissions</h3>
                        </div>
                        <div className="p-6">
                            {safeUser.permissions && safeUser.permissions.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {safeUser.permissions.map((p: string) => (
                                        <span key={p} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-700 dark:text-slate-300 font-mono">
                                            {p}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 italic">No specific permissions assigned.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Password Change Modal ─── */}
            {isPasswordModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-soar-card border border-soar-border rounded-xl p-6 max-w-sm w-full animate-in fade-in zoom-in-95 duration-200 text-start shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-soar-accent/10 flex items-center justify-center shrink-0">
                                <Key className="w-5 h-5 text-soar-accent" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('profile.security.changePassword')}</h3>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="space-y-2">
                                <Label>{t('profile.security.newPassword')} <span className="text-red-500">*</span></Label>
                                <Input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e: any) => setNewPassword(e.target.value)}
                                    placeholder={t('profile.security.enterNewPassword')}
                                    icon={<Key className="w-4 h-4" />}
                                />
                                <p className="text-xs text-slate-500 mt-1">Must be at least 8 characters long.</p>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end rtl:space-x-reverse">
                            <Button variant="ghost" onClick={() => { setIsPasswordModalOpen(false); setNewPassword(''); }} disabled={isChangingPassword}>
                                {t('profile.cancel')}
                            </Button>
                            <Button
                                onClick={handleChangePassword}
                                disabled={isChangingPassword || newPassword.length < 8}
                                className="min-w-[140px]"
                            >
                                {isChangingPassword ? <><Loader2 className="w-4 h-4 me-2 animate-spin" /> {t('profile.security.updating')}</> : t('profile.security.updatePassword')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
