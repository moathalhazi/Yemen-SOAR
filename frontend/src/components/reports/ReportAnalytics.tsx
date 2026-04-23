'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Loader2 } from 'lucide-react';
import { reportsApi } from '@/lib/api';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

export function ReportAnalytics() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [severity, setSeverity] = useState('');

    const fetchAnalytics = async () => {
        try {
            setIsLoading(true);
            const filters: any = {};
            if (dateFrom) filters.date_from = dateFrom;
            if (dateTo) filters.date_to = dateTo;
            if (severity) filters.severity = severity;

            const res = await reportsApi.getAnalytics(filters);
            setData(res);
        } catch (error) {
            console.error('Failed to fetch analytics', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [dateFrom, dateTo, severity]);

    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-soar-primary" /></div>;
    if (!data) return <div className="text-center p-12 text-slate-500">Failed to load analytics</div>;

    const severityData = Object.entries(data.severity_distribution || {}).map(([name, value]) => ({ name, value }));

    return (
        <div className="space-y-6">
            {/* Dynamic Dashboard Filters */}
            <div className="bg-soar-card border border-soar-border p-4 rounded-lg flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Date From</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-soar-bg border border-soar-border rounded p-1.5 text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Date To</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-soar-bg border border-soar-border rounded p-1.5 text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Severity</label>
                    <select value={severity} onChange={e => setSeverity(e.target.value)} className="bg-soar-bg border border-soar-border rounded p-1.5 text-sm">
                        <option value="">All Severities</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </div>
                <button onClick={fetchAnalytics} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-sm transition-colors">Apply Filters</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-soar-bg p-4 rounded-lg border border-soar-border">
                    <h4 className="text-sm font-medium text-slate-500 mb-2">Mean Time To Detect (MTTD)</h4>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {Math.round((data.mttd_avg || 0) / 60)} <span className="text-sm font-normal text-slate-500">mins</span>
                    </p>
                </div>
                <div className="bg-soar-bg p-4 rounded-lg border border-soar-border">
                    <h4 className="text-sm font-medium text-slate-500 mb-2">Mean Time To Respond (MTTR)</h4>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {Math.round((data.mttr_avg || 0) / 60)} <span className="text-sm font-normal text-slate-500">mins</span>
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-soar-bg p-4 rounded-lg border border-soar-border">
                    <h4 className="font-medium text-slate-900 dark:text-white mb-4">Volume Trend</h4>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.incidents_trend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                                <YAxis stroke="#64748b" fontSize={12} />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                                <Area type="monotone" dataKey="alerts" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Alerts" />
                                <Area type="monotone" dataKey="incidents" stackId="1" stroke="#eab308" fill="#eab308" fillOpacity={0.6} name="Incidents" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-soar-bg p-4 rounded-lg border border-soar-border">
                    <h4 className="font-medium text-slate-900 dark:text-white mb-4">Severity Distribution</h4>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={severityData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {severityData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
