'use client';

import { useState, useEffect } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import AnalyticsCard from './AnalyticsCard';
import { useTranslationStore } from '@/stores/i18nStore';

export interface TrendDataPoint {
    date: string;
    incidents: number;
    alerts: number;
    resolved: number;
}

interface IncidentsTrendProps {
    className?: string;
    data?: TrendDataPoint[];
    loading?: boolean;
    timeRange?: '7d' | '30d' | '90d';
    onTimeRangeChange?: (range: '7d' | '30d' | '90d') => void;
}

/**
 * IncidentsTrend - Line chart showing incidents/alerts over time
 * Uses existing recharts library and SOAR color palette
 */
export default function IncidentsTrend({ className, data = [], loading = false, timeRange = '7d', onTimeRangeChange }: IncidentsTrendProps) {
    const { t } = useTranslationStore();
    const TimeRangeSelector = (
        <div className="flex gap-1 bg-soar-bg-secondary rounded-lg p-1">
            {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                    key={range}
                    onClick={() => onTimeRangeChange?.(range)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${timeRange === range
                        ? 'bg-soar-accent text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                >
                    {range}
                </button>
            ))}
        </div>
    );

    return (
        <AnalyticsCard
            title={t('dashboard.incidentsTrend')}
            subtitle={t('dashboard.securityEventsOverTime')}
            loading={loading}
            action={TimeRangeSelector}
            className={className}
        >
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                        dataKey="date"
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                    />
                    <YAxis
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            color: '#fff'
                        }}
                    />
                    <Legend />
                    <Line
                        type="monotone"
                        dataKey="alerts"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ fill: '#f59e0b', r: 3 }}
                        name={t('dashboard.alerts')}
                    />
                    <Line
                        type="monotone"
                        dataKey="incidents"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={{ fill: '#ef4444', r: 3 }}
                        name={t('navigation.incidents')}
                    />
                    <Line
                        type="monotone"
                        dataKey="resolved"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={{ fill: '#22c55e', r: 3 }}
                        name={t('dashboard.resolved')}
                    />
                </LineChart>
            </ResponsiveContainer>
        </AnalyticsCard>
    );
}
