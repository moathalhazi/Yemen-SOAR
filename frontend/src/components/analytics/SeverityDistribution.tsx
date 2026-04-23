'use client';

import { useState, useEffect } from 'react';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend
} from 'recharts';
import AnalyticsCard from './AnalyticsCard';
import { useTranslationStore } from '@/stores/i18nStore';

export interface SeverityData {
    name: string;
    value: number;
    color: string;
}

interface SeverityDistributionProps {
    className?: string;
    data?: SeverityData[];
    loading?: boolean;
}

// SOAR color palette for severities
export const SEVERITY_COLORS = {
    critical: '#dc2626',  // Red
    high: '#f97316',      // Orange
    medium: '#eab308',    // Yellow
    low: '#22c55e'        // Green
};

/**
 * SeverityDistribution - Pie/Donut chart showing threat severity breakdown
 * Uses existing recharts library and SOAR color palette
 */
export default function SeverityDistribution({ className, data = [], loading = false }: SeverityDistributionProps) {
    const { t } = useTranslationStore();
    const total = data.reduce((sum, item) => sum + item.value, 0);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const item = payload[0].payload;
            const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
            return (
                <div className="bg-soar-bg-secondary border border-soar-border rounded-lg p-3">
                    <p className="text-slate-900 dark:text-white font-medium">
                        {t(`dashboard.${item.name.toLowerCase()}`) || item.name}
                    </p>
                    <p className="text-slate-400 text-sm">
                        {item.value} {t('dashboard.alerts').toLowerCase()} ({percentage}%)
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <AnalyticsCard
            title={t('dashboard.severityDistribution') || 'Severity Distribution'}
            subtitle={t('dashboard.alertBreakdownBySeverity') || 'Alert breakdown by severity level'}
            loading={loading}
            className={className}
        >
            <div className="flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                            animationDuration={500}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            formatter={(value) => (
                                <span className="text-slate-600 dark:text-slate-300 text-sm">
                                    {t(`dashboard.${value.toLowerCase()}`) || value}
                                </span>
                            )}
                        />
                    </PieChart>
                </ResponsiveContainer>

                {/* Center total */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none" style={{ marginTop: '-14px' }}>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white leading-none">{total}</p>
                    <p className="text-xs text-slate-400 mt-1">{t('dashboard.totalAlerts').split(' ')[0]} {t('dashboard.alerts')}</p>
                </div>
            </div>
        </AnalyticsCard>
    );
}
