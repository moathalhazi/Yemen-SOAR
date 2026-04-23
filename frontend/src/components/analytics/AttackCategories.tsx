'use client';

import { useState, useEffect } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import AnalyticsCard from './AnalyticsCard';
import { useTranslationStore } from '@/stores/i18nStore';

export interface CategoryData {
    name: string;
    count: number;
    color: string;
}

interface AttackCategoriesProps {
    className?: string;
    data?: CategoryData[];
    loading?: boolean;
}

// Attack type colors
export const ATTACK_COLORS: Record<string, string> = {
    'Malware': '#dc2626',
    'Phishing': '#f97316',
    'DDoS': '#eab308',
    'Brute Force': '#8b5cf6',
    'Ransomware': '#ec4899',
    'Data Exfil': '#06b6d4',
    'APT': '#ef4444',
    'Other': '#64748b'
};

/**
 * AttackCategories - Bar chart showing attack types breakdown
 * Uses existing recharts library and distinct colors per attack type
 */
export default function AttackCategories({ className, data = [], loading = false }: AttackCategoriesProps) {
    const { t } = useTranslationStore();

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-soar-bg-secondary border border-soar-border rounded-lg p-3">
                    <p className="text-slate-900 dark:text-white font-medium">{payload[0].payload.name}</p>
                    <p className="text-slate-400 text-sm">
                        {payload[0].value} {t('navigation.incidents').toLowerCase()}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <AnalyticsCard
            title={t('dashboard.attackCategories') || 'Attack Categories'}
            subtitle={t('dashboard.incidentsByAttackType') || 'Incidents by attack type'}
            loading={loading}
            className={className}
        >
            <ResponsiveContainer width="100%" height={300}>
                <BarChart
                    data={data}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                    <XAxis
                        type="number"
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                    />
                    <YAxis
                        type="category"
                        dataKey="name"
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        width={75}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Bar
                        dataKey="count"
                        radius={[0, 4, 4, 0]}
                        animationDuration={500}
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </AnalyticsCard>
    );
}
