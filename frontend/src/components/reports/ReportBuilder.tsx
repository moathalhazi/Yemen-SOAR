'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { reportsApi } from '@/lib/api';

export function ReportBuilder({ onGenerated }: { onGenerated: () => void }) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [format, setFormat] = useState('pdf');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [severity, setSeverity] = useState('');
    const [status, setStatus] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsGenerating(true);
            const filters: any = { format, include_alerts: true };
            if (dateFrom) filters.date_from = dateFrom;
            if (dateTo) filters.date_to = dateTo;
            if (severity) filters.severity = severity;
            if (status) filters.status = status;

            await reportsApi.generate(filters);
            alert('Report generation queued.');
            onGenerated();
        } catch (error) {
            console.error(error);
            alert('Failed to generate report.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-lg font-medium text-slate-800 dark:text-white">Custom Report Builder</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Date From</label>
                    <input type="date" className="w-full bg-soar-bg border border-soar-border rounded p-2" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Date To</label>
                    <input type="date" className="w-full bg-soar-bg border border-soar-border rounded p-2" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Severity</label>
                    <select className="w-full bg-soar-bg border border-soar-border rounded p-2" value={severity} onChange={e => setSeverity(e.target.value)}>
                        <option value="">All</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Status</label>
                    <select className="w-full bg-soar-bg border border-soar-border rounded p-2" value={status} onChange={e => setStatus(e.target.value)}>
                        <option value="">All</option>
                        <option value="open">Open</option>
                        <option value="investigating">Investigating</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Format</label>
                    <select className="w-full bg-soar-bg border border-soar-border rounded p-2" value={format} onChange={e => setFormat(e.target.value)}>
                        <option value="pdf">PDF Report</option>
                        <option value="csv">CSV Data</option>
                        <option value="json">JSON Export</option>
                        <option value="html">HTML View</option>
                    </select>
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-soar-border">
                <Button type="submit" variant="primary" isLoading={isGenerating}>Generate Report</Button>
            </div>
        </form>
    );
}
