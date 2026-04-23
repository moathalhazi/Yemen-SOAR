import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, icon, ...props }, ref) => {
        return (
            <div className="relative">
                {icon && (
                    <div className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {icon}
                    </div>
                )}
                <input
                    type={type}
                    className={cn(
                        'flex h-10 w-full rounded-lg border border-soar-border bg-soar-bg px-3 py-2 text-sm text-slate-100 ring-offset-soar-bg file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-soar-accent disabled:cursor-not-allowed disabled:opacity-50',
                        icon && 'ps-10',
                        className
                    )}
                    ref={ref}
                    {...props}
                />
            </div>
        );
    }
);
Input.displayName = 'Input';

export default Input;
