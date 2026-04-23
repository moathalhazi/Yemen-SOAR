'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { reportsApi } from '@/lib/api';
import { Loader2, Trash2 } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

export function ReportScheduler() {
    const [schedules, setSchedules] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [scheduleType, setScheduleType] = useState('daily');
    const [format, setFormat] = useState('pdf');

    const fetchSchedules = async () => {
        try {
            setIsLoading(true);
            const res = await reportsApi.getSchedules();
            setSchedules(res);
        } catch (error) {
            console.error('Failed to fetch schedules', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSchedules();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsCreating(true);
            await reportsApi.createSchedule({ name, schedule_type: scheduleType, format, filters: {} });
            setName('');
            fetchSchedules();
        } catch (error) {
            console.error(error);
            alert('Failed to create schedule');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this schedule?')) return;
        try {
            await reportsApi.deleteSchedule(id);
            fetchSchedules();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleCreate} className="bg-soar-bg p-4 rounded-lg border border-soar-border flex items-end gap-4">
                <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">Schedule Name</label>
                    <input required type="text" className="w-full bg-soar-card border border-soar-border rounded p-2" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Daily Security Summary" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Frequency</label>
                    <select className="bg-soar-card border border-soar-border rounded p-2" value={scheduleType} onChange={e => setScheduleType(e.target.value)}>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Format</label>
                    <select className="bg-soar-card border border-soar-border rounded p-2" value={format} onChange={e => setFormat(e.target.value)}>
                        <option value="pdf">PDF</option>
                        <option value="csv">CSV</option>
                        <option value="json">JSON</option>
                    </select>
                </div>
                <Button type="submit" variant="primary" isLoading={isCreating}>Add Schedule</Button>
            </form>

            <div className="bg-soar-bg rounded-lg border border-soar-border overflow-hidden">
                {isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                ) : schedules.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">No active schedules</div>
                ) : (
                    <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-800 dark:text-slate-400 border-b border-soar-border">
                            <tr>
                                <th className="px-6 py-3">Name</th>
                                <th className="px-6 py-3">Frequency</th>
                                <th className="px-6 py-3">Format</th>
                                <th className="px-6 py-3">Next Run</th>
                                <th className="px-6 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {schedules.map(s => (
                                <tr key={s.id} className="border-b border-soar-border hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{s.name}</td>
                                    <td className="px-6 py-4 capitalize">{s.schedule_type}</td>
                                    <td className="px-6 py-4 uppercase">{s.format}</td>
                                    <td className="px-6 py-4">{s.next_run_at ? formatRelativeTime(s.next_run_at) : 'N/A'}</td>
                                    <td className="px-6 py-4">
                                        <button onClick={() => handleDelete(s.id)} className="text-rose-500 hover:text-rose-700"><Trash2 className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
