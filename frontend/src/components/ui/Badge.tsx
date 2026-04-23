import { cn, getSeverityColor, getStatusColor, capitalize } from '@/lib/utils';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'severity' | 'status';
    value?: string;
    className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                variant === 'default' && 'bg-soar-card text-slate-300',
                className
            )}
        >
            {children}
        </span>
    );
}

interface SeverityBadgeProps {
    severity: string;
    className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                getSeverityColor(severity),
                className
            )}
        >
            {capitalize(severity)}
        </span>
    );
}

interface StatusBadgeProps {
    status: string;
    className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                getStatusColor(status),
                className
            )}
        >
            {capitalize(status)}
        </span>
    );
}

interface PriorityBadgeProps {
    priority: number;
    className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
    const colors: Record<number, string> = {
        1: 'bg-red-500 text-white',
        2: 'bg-orange-500 text-white',
        3: 'bg-yellow-500 text-black',
        4: 'bg-blue-500 text-white',
        5: 'bg-gray-500 text-white',
    };

    return (
        <span
            className={cn(
                'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold',
                colors[priority] || colors[5],
                className
            )}
        >
            P{priority}
        </span>
    );
}
