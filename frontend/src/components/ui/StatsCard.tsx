import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
    title: string;
    value: string | number;
    change?: {
        value: number;
        type: 'increase' | 'decrease' | 'neutral';
    };
    icon: LucideIcon;
    iconColor?: string;
    subtitle?: string;
}

export default function StatsCard({
    title,
    value,
    change,
    icon: Icon,
    iconColor = 'text-soar-accent',
    subtitle,
}: StatsCardProps) {
    return (
        <div className="card hover:border-soar-accent/50 transition-colors">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-400">{title}</p>
                    <p className="mt-2 text-3xl font-bold">{value}</p>
                    {subtitle && (
                        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
                    )}
                    {change && (
                        <p
                            className={cn(
                                'mt-2 text-sm flex items-center gap-1',
                                change.type === 'increase' && 'text-green-500',
                                change.type === 'decrease' && 'text-red-500',
                                change.type === 'neutral' && 'text-slate-400'
                            )}
                        >
                            {change.type === 'increase' && '↑'}
                            {change.type === 'decrease' && '↓'}
                            {Math.abs(change.value)}%{' '}
                            <span className="text-slate-500">vs last 24h</span>
                        </p>
                    )}
                </div>
                <div
                    className={cn(
                        'p-3 rounded-lg bg-soar-card',
                        iconColor
                    )}
                >
                    <Icon className="w-6 h-6" />
                </div>
            </div>
        </div>
    );
}
