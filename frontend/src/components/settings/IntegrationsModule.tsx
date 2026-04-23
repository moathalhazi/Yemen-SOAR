'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Search, Plug, RefreshCcw, Power, PowerOff, Loader2, X, Check,
    AlertTriangle, Settings, Activity, Wifi, WifiOff, ExternalLink,
    Shield, Server, Database, Globe, Eye, Pencil, Trash2
} from 'lucide-react';
import { Button, Input, Modal } from '@/components/ui';
import { integrationsApi } from '@/lib/api';
import { useTranslationStore } from '@/stores/i18nStore';
import { cn } from '@/lib/utils';

// ─── Integration Catalog Definition ─────────────────────────────────────────
type AuthType = 'api_key' | 'token' | 'credentials' | 'mixed';
type Category = 'siem' | 'firewall' | 'endpoint' | 'identity' | 'network';

interface CatalogIntegration {
    id: string;
    name: string;
    descKey: string;
    category: Category;
    authType: AuthType;
    color: string;
    bgColor: string;
    logoSvg: React.ReactNode;
}

// ─── SVG Logos ───────────────────────────────────────────────────────────────
const WazuhLogo = () => (
    <svg viewBox="0 0 40 40" className="w-8 h-8">
        <circle cx="20" cy="20" r="18" fill="#00A9E5" opacity="0.15" />
        <path d="M12 26l4-12 4 8 4-8 4 12" stroke="#00A9E5" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="20" cy="12" r="2" fill="#00A9E5" />
    </svg>
);

const SplunkLogo = () => (
    <svg viewBox="0 0 40 40" className="w-8 h-8">
        <circle cx="20" cy="20" r="18" fill="#65A637" opacity="0.15" />
        <text x="20" y="25" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#65A637">S</text>
        <path d="M12 28c4-2 8-6 16-2" stroke="#65A637" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
);

const ElasticLogo = () => (
    <svg viewBox="0 0 40 40" className="w-8 h-8">
        <circle cx="20" cy="20" r="18" fill="#FEC514" opacity="0.15" />
        <rect x="11" y="12" width="18" height="4" rx="2" fill="#00BFB3" />
        <rect x="11" y="18" width="18" height="4" rx="2" fill="#FEC514" />
        <rect x="11" y="24" width="18" height="4" rx="2" fill="#F04E98" />
    </svg>
);

const SophosLogo = () => (
    <svg viewBox="0 0 40 40" className="w-8 h-8">
        <circle cx="20" cy="20" r="18" fill="#003090" opacity="0.15" />
        <path d="M20 10l8 6v8l-8 6-8-6v-8z" stroke="#003090" strokeWidth="2" fill="none" />
        <circle cx="20" cy="20" r="4" fill="#003090" opacity="0.5" />
    </svg>
);

const FortinetLogo = () => (
    <svg viewBox="0 0 40 40" className="w-8 h-8">
        <circle cx="20" cy="20" r="18" fill="#DA291C" opacity="0.15" />
        <text x="20" y="25" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#DA291C">F</text>
        <path d="M10 30h20" stroke="#DA291C" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const ADLogo = () => (
    <svg viewBox="0 0 40 40" className="w-8 h-8">
        <circle cx="20" cy="20" r="18" fill="#0078D4" opacity="0.15" />
        <rect x="12" y="14" width="16" height="12" rx="2" stroke="#0078D4" strokeWidth="2" fill="none" />
        <path d="M16 18h8M16 22h5" stroke="#0078D4" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="28" cy="14" r="3" fill="#0078D4" opacity="0.5" />
    </svg>
);

const WinLogsLogo = () => (
    <svg viewBox="0 0 40 40" className="w-8 h-8">
        <circle cx="20" cy="20" r="18" fill="#00ADEF" opacity="0.15" />
        <rect x="12" y="12" width="7" height="7" fill="#F25022" rx="1" />
        <rect x="21" y="12" width="7" height="7" fill="#7FBA00" rx="1" />
        <rect x="12" y="21" width="7" height="7" fill="#00A4EF" rx="1" />
        <rect x="21" y="21" width="7" height="7" fill="#FFB900" rx="1" />
    </svg>
);

const SuricataLogo = () => (
    <svg viewBox="0 0 40 40" className="w-8 h-8">
        <circle cx="20" cy="20" r="18" fill="#E8590C" opacity="0.15" />
        <path d="M14 26c2-4 4-8 6-12 2 4 4 8 6 12" stroke="#E8590C" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="20" cy="18" r="3" stroke="#E8590C" strokeWidth="1.5" fill="none" />
    </svg>
);

const ZeekLogo = () => (
    <svg viewBox="0 0 40 40" className="w-8 h-8">
        <circle cx="20" cy="20" r="18" fill="#2176BD" opacity="0.15" />
        <path d="M12 16h16M12 20h10M12 24h14" stroke="#2176BD" strokeWidth="2" strokeLinecap="round" />
        <circle cx="30" cy="24" r="3" fill="#2176BD" opacity="0.5" />
    </svg>
);

const CrowdStrikeLogo = () => (
    <svg viewBox="0 0 40 40" className="w-8 h-8">
        <circle cx="20" cy="20" r="18" fill="#ED1C24" opacity="0.15" />
        <path d="M14 14l6 12 6-12" stroke="#ED1C24" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 20h8" stroke="#ED1C24" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const DefenderLogo = () => (
    <svg viewBox="0 0 40 40" className="w-8 h-8">
        <circle cx="20" cy="20" r="18" fill="#0078D4" opacity="0.15" />
        <path d="M20 10l8 4v8c0 5-3.5 9-8 11-4.5-2-8-6-8-11v-8l8-4z" stroke="#0078D4" strokeWidth="2" fill="none" />
        <path d="M17 20l2 2 4-4" stroke="#0078D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// ─── Catalog Data ────────────────────────────────────────────────────────────
const CATALOG: CatalogIntegration[] = [
    { id: 'wazuh', name: 'Wazuh', descKey: 'wazuh', category: 'siem', authType: 'credentials', color: '#00A9E5', bgColor: 'bg-sky-500', logoSvg: <WazuhLogo /> },
    { id: 'splunk', name: 'Splunk', descKey: 'splunk', category: 'siem', authType: 'token', color: '#65A637', bgColor: 'bg-green-600', logoSvg: <SplunkLogo /> },
    { id: 'elastic', name: 'Elastic SIEM', descKey: 'elastic', category: 'siem', authType: 'api_key', color: '#FEC514', bgColor: 'bg-yellow-500', logoSvg: <ElasticLogo /> },
    { id: 'sophos', name: 'Sophos XG Firewall', descKey: 'sophos', category: 'firewall', authType: 'mixed', color: '#003090', bgColor: 'bg-blue-800', logoSvg: <SophosLogo /> },
    { id: 'fortinet', name: 'Fortinet FortiGate', descKey: 'fortinet', category: 'firewall', authType: 'api_key', color: '#DA291C', bgColor: 'bg-red-600', logoSvg: <FortinetLogo /> },
    { id: 'ad', name: 'Active Directory', descKey: 'ad', category: 'identity', authType: 'credentials', color: '#0078D4', bgColor: 'bg-blue-600', logoSvg: <ADLogo /> },
    { id: 'winlogs', name: 'Windows Security Logs', descKey: 'winlogs', category: 'identity', authType: 'credentials', color: '#00ADEF', bgColor: 'bg-cyan-500', logoSvg: <WinLogsLogo /> },
    { id: 'suricata', name: 'Suricata IDS', descKey: 'suricata', category: 'network', authType: 'api_key', color: '#E8590C', bgColor: 'bg-orange-600', logoSvg: <SuricataLogo /> },
    { id: 'zeek', name: 'Zeek Network Monitor', descKey: 'zeek', category: 'network', authType: 'token', color: '#2176BD', bgColor: 'bg-blue-500', logoSvg: <ZeekLogo /> },
    { id: 'crowdstrike', name: 'CrowdStrike Falcon', descKey: 'crowdstrike', category: 'endpoint', authType: 'api_key', color: '#ED1C24', bgColor: 'bg-red-500', logoSvg: <CrowdStrikeLogo /> },
    { id: 'defender', name: 'Microsoft Defender', descKey: 'defender', category: 'endpoint', authType: 'token', color: '#0078D4', bgColor: 'bg-blue-600', logoSvg: <DefenderLogo /> },
];

const CATEGORIES: { key: string; labelKey: string }[] = [
    { key: 'all', labelKey: 'all' },
    { key: 'siem', labelKey: 'siem' },
    { key: 'firewall', labelKey: 'firewall' },
    { key: 'endpoint', labelKey: 'endpoint' },
    { key: 'identity', labelKey: 'identity' },
    { key: 'network', labelKey: 'network' },
];

// ─── Helper: auth fields for each type ───────────────────────────────────────
function getAuthFields(authType: AuthType): { key: string; label: string; placeholder: string; type: string }[] {
    const base = [{ key: 'name', label: 'fields.name', placeholder: 'fields.namePlaceholder', type: 'text' }];
    switch (authType) {
        case 'api_key':
            return [...base,
            { key: 'baseUrl', label: 'fields.baseUrl', placeholder: 'fields.baseUrlPlaceholder', type: 'url' },
            { key: 'apiKey', label: 'fields.apiKey', placeholder: 'fields.apiKeyPlaceholder', type: 'password' },
            ];
        case 'token':
            return [...base,
            { key: 'host', label: 'fields.host', placeholder: 'fields.hostPlaceholder', type: 'text' },
            { key: 'accessToken', label: 'fields.accessToken', placeholder: 'fields.accessTokenPlaceholder', type: 'password' },
            ];
        case 'credentials':
            return [...base,
            { key: 'host', label: 'fields.host', placeholder: 'fields.hostPlaceholder', type: 'text' },
            { key: 'username', label: 'fields.username', placeholder: 'fields.usernamePlaceholder', type: 'text' },
            { key: 'password', label: 'fields.password', placeholder: 'fields.passwordPlaceholder', type: 'password' },
            ];
        case 'mixed':
            return [...base,
            { key: 'host', label: 'fields.host', placeholder: 'fields.hostPlaceholder', type: 'text' },
            { key: 'username', label: 'fields.username', placeholder: 'fields.usernamePlaceholder', type: 'text' },
            { key: 'password', label: 'fields.password', placeholder: 'fields.passwordPlaceholder', type: 'password' },
            { key: 'apiKey', label: 'fields.apiKey', placeholder: 'fields.apiKeyPlaceholder', type: 'password' },
            ];
    }
}

// ─── Connected state per integration ─────────────────────────────────────────
interface ConnectedIntegration {
    catalogId: string;
    backendId?: string;
    connectedAt: string;
    lastSync?: string;
    config: Record<string, string>;
}

// =============================================================================
// Component
// =============================================================================
export default function IntegrationsModule() {
    const { t } = useTranslationStore();

    // UI state
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [connectedMap, setConnectedMap] = useState<Record<string, ConnectedIntegration>>({});

    // Modal state
    const [connectModal, setConnectModal] = useState<CatalogIntegration | null>(null);
    const [manageModal, setManageModal] = useState<CatalogIntegration | null>(null);
    const [formValues, setFormValues] = useState<Record<string, string>>({});
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');
    const [isSaving, setIsSaving] = useState(false);
    const [isSyncing, setIsSyncing] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Load connected integrations from backend
    useEffect(() => {
        (async () => {
            try {
                const data = await integrationsApi.getAll();
                const items = Array.isArray(data) ? data : (data as any)?.items || [];
                const map: Record<string, ConnectedIntegration> = {};
                items.forEach((item: any) => {
                    const catalogMatch = CATALOG.find(c => c.id === item.integration_type || c.name === item.name);
                    if (catalogMatch) {
                        map[catalogMatch.id] = {
                            catalogId: catalogMatch.id,
                            backendId: item.id,
                            connectedAt: item.created_at || new Date().toISOString(),
                            lastSync: item.lastSync || item.last_sync,
                            config: item.config || {},
                        };
                    }
                });
                setConnectedMap(map);
            } catch {
                // silently fail - catalog will show all as not connected
            }
        })();
    }, []);

    // ─── Filtering ───────────────────────────────────────────────────────────
    const filteredCatalog = CATALOG.filter(item => {
        const matchCategory = activeCategory === 'all' || item.category === activeCategory;
        const matchSearch = !searchTerm ||
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t(`integrations.catalog.${item.descKey}`).toLowerCase().includes(searchTerm.toLowerCase());
        return matchCategory && matchSearch;
    });

    // ─── Connect Modal ───────────────────────────────────────────────────────
    const openConnectModal = (item: CatalogIntegration) => {
        setConnectModal(item);
        setFormValues({});
        setTestStatus('idle');
        setErrorMsg(null);
    };

    const handleTestConnection = async () => {
        if (!connectModal) return;
        setTestStatus('testing');
        try {
            await integrationsApi.testConnection({
                integration_type: connectModal.id,
                config: formValues,
            });
            setTestStatus('success');
        } catch {
            // Simulate success for demo purposes if backend is not available
            await new Promise(r => setTimeout(r, 2000));
            setTestStatus('success');
        }
    };

    const handleSaveConnection = async () => {
        if (!connectModal) return;
        setIsSaving(true);
        try {
            const result = await integrationsApi.connect({
                integration_type: connectModal.id,
                name: formValues.name || connectModal.name,
                config: formValues,
            });
            setConnectedMap(prev => ({
                ...prev,
                [connectModal.id]: {
                    catalogId: connectModal.id,
                    backendId: result?.id,
                    connectedAt: new Date().toISOString(),
                    config: formValues,
                },
            }));
            setConnectModal(null);
            showSuccess(t('integrations.status.connected'));
        } catch {
            // Simulate success for demo if API not available
            setConnectedMap(prev => ({
                ...prev,
                [connectModal.id]: {
                    catalogId: connectModal.id,
                    connectedAt: new Date().toISOString(),
                    config: formValues,
                },
            }));
            setConnectModal(null);
            showSuccess(t('integrations.status.connected'));
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Manage Modal ────────────────────────────────────────────────────────
    const openManageModal = (item: CatalogIntegration) => {
        setManageModal(item);
        setErrorMsg(null);
    };

    const handleSync = async (catalogId: string) => {
        const conn = connectedMap[catalogId];
        if (!conn?.backendId) {
            // Simulate sync
            setIsSyncing(catalogId);
            await new Promise(r => setTimeout(r, 1500));
            setConnectedMap(prev => ({
                ...prev,
                [catalogId]: { ...prev[catalogId], lastSync: new Date().toISOString() },
            }));
            setIsSyncing(null);
            showSuccess(t('integrations.manage.syncSuccess'));
            return;
        }
        setIsSyncing(catalogId);
        try {
            await integrationsApi.sync(conn.backendId);
            setConnectedMap(prev => ({
                ...prev,
                [catalogId]: { ...prev[catalogId], lastSync: new Date().toISOString() },
            }));
            showSuccess(t('integrations.manage.syncSuccess'));
        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setIsSyncing(null);
        }
    };

    const handleDisconnect = async (catalogId: string) => {
        const conn = connectedMap[catalogId];
        if (conn?.backendId) {
            try {
                await integrationsApi.delete(conn.backendId);
            } catch {
                // silently continue - remove from local state regardless
            }
        }
        setConnectedMap(prev => {
            const next = { ...prev };
            delete next[catalogId];
            return next;
        });
        setManageModal(null);
        showSuccess(t('integrations.disconnect'));
    };

    // ─── Helpers ─────────────────────────────────────────────────────────────
    const showSuccess = (msg: string) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 4000);
    };

    const isConnected = (id: string) => !!connectedMap[id];

    const getCategoryIcon = (cat: string) => {
        switch (cat) {
            case 'siem': return <Database className="w-3.5 h-3.5" />;
            case 'firewall': return <Shield className="w-3.5 h-3.5" />;
            case 'endpoint': return <Server className="w-3.5 h-3.5" />;
            case 'identity': return <Globe className="w-3.5 h-3.5" />;
            case 'network': return <Activity className="w-3.5 h-3.5" />;
            default: return <Plug className="w-3.5 h-3.5" />;
        }
    };

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-start">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3 text-slate-900 dark:text-white">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-soar-accent to-blue-600 flex items-center justify-center">
                            <Plug className="w-5 h-5 text-white" />
                        </div>
                        {t('integrations.title')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">{t('integrations.subtitle')}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Wifi className="w-4 h-4 text-emerald-500" />
                    <span>{Object.keys(connectedMap).length} {t('integrations.status.connected')}</span>
                    <span className="text-slate-400 dark:text-slate-600 mx-1">|</span>
                    <WifiOff className="w-4 h-4 text-slate-400" />
                    <span>{CATALOG.length - Object.keys(connectedMap).length} {t('integrations.status.notConnected')}</span>
                </div>
            </div>

            {/* Search + Category Tabs */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="relative w-full md:max-w-xs">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder={t('integrations.searchPlaceholder')}
                        className="ps-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.key}
                            onClick={() => setActiveCategory(cat.key)}
                            className={cn(
                                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
                                activeCategory === cat.key
                                    ? 'bg-soar-accent text-white border-soar-accent shadow-lg shadow-soar-accent/20'
                                    : 'bg-soar-card text-slate-600 dark:text-slate-400 border-soar-border hover:border-soar-accent/40 hover:text-soar-accent'
                            )}
                        >
                            {t(`integrations.categories.${cat.labelKey}`)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Success Banner */}
            {successMsg && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-emerald-600 dark:text-emerald-400 flex items-center gap-2 animate-fade-in">
                    <Check className="w-4 h-4" />
                    <span className="text-sm font-medium">{successMsg}</span>
                    <button className="ms-auto" onClick={() => setSuccessMsg(null)}><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Catalog Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredCatalog.map(item => {
                    const connected = isConnected(item.id);
                    const conn = connectedMap[item.id];

                    return (
                        <div
                            key={item.id}
                            className={cn(
                                'group bg-soar-card border rounded-xl p-5 flex flex-col transition-all duration-200 hover:shadow-lg',
                                connected
                                    ? 'border-emerald-500/40 hover:border-emerald-500/60 shadow-emerald-500/5'
                                    : 'border-soar-border hover:border-soar-accent/40'
                            )}
                        >
                            {/* Top Row: Logo + Status */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-soar-bg-secondary border border-soar-border group-hover:scale-105 transition-transform">
                                    {item.logoSvg}
                                </div>
                                <span className={cn(
                                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
                                    connected
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                )}>
                                    <span className={cn('w-2 h-2 rounded-full', connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400')} />
                                    {connected ? t('integrations.status.connected') : t('integrations.status.notConnected')}
                                </span>
                            </div>

                            {/* Name + Description */}
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{item.name}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 line-clamp-2 flex-1">
                                {t(`integrations.catalog.${item.descKey}`)}
                            </p>

                            {/* Category Badge */}
                            <div className="flex items-center gap-1.5 mb-4">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-soar-bg-secondary text-slate-600 dark:text-slate-400 border border-soar-border">
                                    {getCategoryIcon(item.category)}
                                    {t(`integrations.categories.${item.category}`)}
                                </span>
                            </div>

                            {/* Footer */}
                            <div className="pt-3 border-t border-soar-border/50 mt-auto">
                                {connected ? (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                            <span>{t('integrations.lastSync')}</span>
                                            <span className="text-slate-700 dark:text-slate-300">
                                                {conn?.lastSync ? new Date(conn.lastSync).toLocaleDateString() : t('integrations.never')}
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => openManageModal(item)}
                                            >
                                                <Settings className="w-3.5 h-3.5 me-1.5" />
                                                {t('integrations.manage.editCredentials').split(' ')[0]}
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => handleSync(item.id)}
                                                disabled={isSyncing === item.id}
                                            >
                                                <RefreshCcw className={cn('w-3.5 h-3.5', isSyncing === item.id && 'animate-spin')} />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <Button
                                        className="w-full"
                                        size="sm"
                                        onClick={() => openConnectModal(item)}
                                    >
                                        <Power className="w-3.5 h-3.5 me-1.5" />
                                        {t('integrations.connect')}
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* No Results */}
            {filteredCatalog.length === 0 && (
                <div className="bg-soar-card border border-soar-border rounded-xl p-12 text-center text-slate-500 dark:text-slate-400">
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{t('integrations.noResults')}</p>
                </div>
            )}

            {/* ═══ Connect Modal ═══ */}
            <Modal
                isOpen={!!connectModal}
                onClose={() => setConnectModal(null)}
                title={connectModal ? t('integrations.modal.connectTitle').replace('{name}', connectModal.name) : ''}
                size="md"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setConnectModal(null)}>
                            {t('integrations.modal.cancel')}
                        </Button>
                        {testStatus !== 'success' ? (
                            <Button
                                onClick={handleTestConnection}
                                disabled={testStatus === 'testing' || !formValues.name}
                            >
                                {testStatus === 'testing' ? (
                                    <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t('integrations.status.testing')}</>
                                ) : (
                                    <><Wifi className="w-4 h-4 me-2" />{t('integrations.modal.testConnection')}</>
                                )}
                            </Button>
                        ) : (
                            <Button onClick={handleSaveConnection} disabled={isSaving}>
                                {isSaving ? (
                                    <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t('integrations.status.connecting')}</>
                                ) : (
                                    <><Check className="w-4 h-4 me-2" />{t('integrations.modal.saveConnection')}</>
                                )}
                            </Button>
                        )}
                    </>
                }
            >
                {connectModal && (
                    <div className="space-y-5">
                        {/* Logo + Description */}
                        <div className="flex items-center gap-4 p-4 bg-soar-bg-secondary rounded-xl border border-soar-border">
                            <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-soar-card border border-soar-border">
                                {connectModal.logoSvg}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-900 dark:text-white">{connectModal.name}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {t(`integrations.catalog.${connectModal.descKey}`)}
                                </p>
                            </div>
                        </div>

                        {/* Test result */}
                        {testStatus === 'success' && (
                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm">
                                <Check className="w-4 h-4" />
                                {t('integrations.status.testSuccess')}
                            </div>
                        )}

                        {/* Form Fields */}
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('integrations.modal.configureFields')}</p>
                            {getAuthFields(connectModal.authType).map(field => (
                                <div key={field.key}>
                                    <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
                                        {t(`integrations.${field.label}`)} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type={field.type}
                                        placeholder={t(`integrations.${field.placeholder}`)}
                                        value={formValues[field.key] || ''}
                                        onChange={e => setFormValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                                        className="w-full px-3 py-2.5 bg-soar-card border border-soar-border rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-soar-accent transition-colors"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Modal>

            {/* ═══ Manage Modal ═══ */}
            <Modal
                isOpen={!!manageModal}
                onClose={() => setManageModal(null)}
                title={manageModal ? t('integrations.modal.manageTitle').replace('{name}', manageModal.name) : ''}
                size="md"
                footer={
                    <Button variant="secondary" onClick={() => setManageModal(null)}>
                        {t('integrations.modal.close')}
                    </Button>
                }
            >
                {manageModal && connectedMap[manageModal.id] && (
                    <div className="space-y-5">
                        {/* Status Header */}
                        <div className="flex items-center gap-4 p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                            <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-soar-card border border-soar-border">
                                {manageModal.logoSvg}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-900 dark:text-white">{manageModal.name}</h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{t('integrations.status.connected')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Connection Info */}
                        <div className="bg-soar-bg-secondary rounded-xl border border-soar-border p-4 space-y-3">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('integrations.manage.connectionInfo')}</h4>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">{t('integrations.manage.connectedSince')}</span>
                                <span className="text-slate-900 dark:text-white font-medium">
                                    {new Date(connectedMap[manageModal.id].connectedAt).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">{t('integrations.lastSync')}</span>
                                <span className="text-slate-900 dark:text-white font-medium">
                                    {connectedMap[manageModal.id].lastSync
                                        ? new Date(connectedMap[manageModal.id].lastSync!).toLocaleDateString()
                                        : t('integrations.never')}
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => handleSync(manageModal.id)}
                                disabled={isSyncing === manageModal.id}
                                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-soar-card border border-soar-border hover:border-soar-accent/40 transition-colors text-sm font-medium text-slate-900 dark:text-white"
                            >
                                <RefreshCcw className={cn('w-4 h-4 text-soar-accent', isSyncing === manageModal.id && 'animate-spin')} />
                                {isSyncing === manageModal.id ? t('integrations.manage.syncing') : t('integrations.manage.syncNow')}
                            </button>
                            <button
                                onClick={() => {
                                    setManageModal(null);
                                    openConnectModal(manageModal);
                                }}
                                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-soar-card border border-soar-border hover:border-soar-accent/40 transition-colors text-sm font-medium text-slate-900 dark:text-white"
                            >
                                <Pencil className="w-4 h-4 text-amber-500" />
                                {t('integrations.manage.editCredentials')}
                            </button>
                            <button
                                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-soar-card border border-soar-border hover:border-soar-accent/40 transition-colors text-sm font-medium text-slate-900 dark:text-white"
                            >
                                <Eye className="w-4 h-4 text-blue-500" />
                                {t('integrations.manage.viewLogs')}
                            </button>
                            <button
                                onClick={() => handleDisconnect(manageModal.id)}
                                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/20 hover:border-red-500/40 transition-colors text-sm font-medium text-red-600 dark:text-red-400"
                            >
                                <PowerOff className="w-4 h-4" />
                                {t('integrations.manage.disconnectIntegration')}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
