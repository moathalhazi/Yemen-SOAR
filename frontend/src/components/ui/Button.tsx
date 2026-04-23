import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    icon?: LucideIcon;
    iconPosition?: 'left' | 'right';
    isLoading?: boolean;
}

export default function Button({
    children,
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconPosition = 'left',
    isLoading = false,
    className,
    disabled,
    ...props
}: ButtonProps) {
    const variants = {
        primary: 'bg-soar-accent hover:bg-soar-accent-hover text-black dark:text-white',
        secondary: 'bg-soar-card hover:bg-soar-border text-black dark:text-white',
        danger: 'bg-red-600 hover:bg-red-700 text-black dark:text-white',
        ghost: 'bg-transparent hover:bg-soar-card text-black dark:text-slate-400 hover:text-black dark:hover:text-white',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2',
        lg: 'px-6 py-3 text-lg',
    };

    const iconSizes = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6',
    };

    return (
        <button
            className={cn(
                'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                variants[variant],
                sizes[size],
                className
            )}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <div
                    className={cn(
                        'border-2 border-current border-t-transparent rounded-full animate-spin',
                        iconSizes[size]
                    )}
                />
            ) : (
                <>
                    {Icon && iconPosition === 'left' && (
                        <Icon className={iconSizes[size]} />
                    )}
                    {children}
                    {Icon && iconPosition === 'right' && (
                        <Icon className={iconSizes[size]} />
                    )}
                </>
            )}
        </button>
    );
}
