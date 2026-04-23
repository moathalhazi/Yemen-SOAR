'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AnalyticsCardProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
    className?: string;
    loading?: boolean;
    action?: ReactNode;
    noPadding?: boolean;
}

/**
 * AnalyticsCard - Reusable wrapper for analytics charts
 * Follows existing dashboard card styling for consistency
 */
export default function AnalyticsCard({
    title,
    subtitle,
    children,
    className,
    loading = false,
    action,
    noPadding = false
}: AnalyticsCardProps) {
    return (
        <div className={cn(
            'bg-soar-card rounded-xl border border-soar-border',
            noPadding ? 'p-0' : 'p-6',
            className
        )}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
                    {subtitle && (
                        <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
                    )}
                </div>
                {action && <div>{action}</div>}
            </div>

            {/* Content */}
            <div className="relative">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-soar-accent"></div>
                    </div>
                ) : (
                    children
                )}
            </div>
        </div>
    );
}
