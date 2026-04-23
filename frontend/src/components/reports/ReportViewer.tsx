import { useState } from 'react';
import {
    AlertTriangle,
    FileWarning,
    PlayCircle,
    CheckCircle2,
    Clock,
    User,
    Calendar,
    Shield
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Button, SeverityBadge, StatusBadge } from '@/components/ui';
import { StatsCard } from '@/components/ui';
import SystemHealth from '@/components/analytics/SystemHealth';
import { cn } from '@/lib/utils';
import type { Report } from '@/types';

interface ReportViewerProps {
    isOpen: boolean;
    onClose: () => void;
    report: Report | null;
}

export default function ReportViewer({ isOpen, onClose, report }: ReportViewerProps) {
    const [activeTab, setActiveTab] = useState<'summary' | 'incidents' | 'alerts' | 'health'>('summary');

    if (!report || !report.data) return null;

    const { data, metadata } = report;
    const stats = data.stats || {};

    const tabs = [
        { id: 'summary', label: 'Executive Summary' },
        { id: 'incidents', label: 'Incidents' },
        { id: 'alerts', label: 'Alerts' },
        { id: 'health', label: 'System Health' },
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={report.name}
            size="xl"
            footer={
                <Button onClick={onClose} variant="secondary">
                    Close
                </Button>
            }
        >
            <div className="space-y-6">
                {/* Header Metadata */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400 border-b border-soar-border pb-4">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Generated: {new Date(report.generated_at).toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Period: {new Date(metadata?.start_date).toLocaleDateString()} - {new Date(metadata?.end_date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        By: {metadata?.generated_by || 'System'}
                    </div>
                    <StatusBadge status={report.status} />
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-soar-border">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={cn(
                                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                                activeTab === tab.id
                                    ? "border-soar-accent text-soar-accent"
                                    : "border-transparent text-slate-400 hover:text-white"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="min-h-[400px]">
                    {activeTab === 'summary' && (
                        <div className="space-y-6 animate-in fade-in">
                            {/* KPI Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <StatsCard
                                    title="Total Alerts"
                                    value={stats.total_alerts || 0}
                                    icon={AlertTriangle}
                                    iconColor="text-orange-500"
                                />
                                <StatsCard
                                    title="Total Incidents"
                                    value={stats.total_incidents || 0}
                                    icon={FileWarning}
                                    iconColor="text-red-500"
                                />
                                <StatsCard
                                    title="Active Playbooks"
                                    value={stats.active_playbooks || 0}
                                    icon={PlayCircle}
                                    iconColor="text-green-500"
                                />
                                <StatsCard
                                    title="Resolved Alerts"
                                    value={stats.resolved_alerts || 0}
                                    icon={CheckCircle2}
                                    iconColor="text-blue-500"
                                />
                            </div>

                            <div className="p-8 text-center border border-soar-border rounded-xl bg-soar-bg-tertiary">
                                <Shield className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                                <p className="text-slate-400">Detailed trend analytics not captured in this snapshot version.</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'incidents' && (
                        <div className="space-y-4 animate-in fade-in">
                            {data.incidents?.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-soar-bg-secondary text-slate-400">
                                            <tr>
                                                <th className="p-3">ID</th>
                                                <th className="p-3">Title</th>
                                                <th className="p-3">Severity</th>
                                                <th className="p-3">Status</th>
                                                <th className="p-3">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-soar-border">
                                            {data.incidents.map((inc: any, i: number) => (
                                                <tr key={i} className="hover:bg-soar-bg-tertiary">
                                                    <td className="p-3 font-mono text-xs">{inc.incident_number}</td>
                                                    <td className="p-3 font-medium">{inc.title}</td>
                                                    <td className="p-3">
                                                        <SeverityBadge severity={inc.severity} />
                                                    </td>
                                                    <td className="p-3">
                                                        <StatusBadge status={inc.status} />
                                                    </td>
                                                    <td className="p-3 text-slate-400">{new Date(inc.created_at).toLocaleDateString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-10 text-slate-500">No incidents found in this period.</div>
                            )}
                        </div>
                    )}

                    {activeTab === 'alerts' && (
                        <div className="space-y-4 animate-in fade-in">
                            {data.alerts?.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-soar-bg-secondary text-slate-400">
                                            <tr>
                                                <th className="p-3">Title</th>
                                                <th className="p-3">Severity</th>
                                                <th className="p-3">Source</th>
                                                <th className="p-3">Status</th>
                                                <th className="p-3">Received</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-soar-border">
                                            {data.alerts.map((alert: any, i: number) => (
                                                <tr key={i} className="hover:bg-soar-bg-tertiary">
                                                    <td className="p-3 font-medium">{alert.title}</td>
                                                    <td className="p-3">
                                                        <SeverityBadge severity={alert.severity} />
                                                    </td>
                                                    <td className="p-3">{alert.source_name}</td>
                                                    <td className="p-3">
                                                        <StatusBadge status={alert.status} />
                                                    </td>
                                                    <td className="p-3 text-slate-400">{new Date(alert.received_at).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-10 text-slate-500">No alerts found in this period.</div>
                            )}
                        </div>
                    )}

                    {activeTab === 'health' && (
                        <div className="animate-in fade-in">
                            {/* Use SystemHealth with initialData */}
                            <SystemHealth
                                initialData={data.health?.map((h: any) => ({
                                    ...h,
                                    lastCheck: new Date(), // Snapshot doesn't save lastCheck explicitly usually, or we can assume generated_at
                                }))}
                            />
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
