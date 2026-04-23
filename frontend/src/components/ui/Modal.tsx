'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    footer?: React.ReactNode;
}

export default function Modal({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    footer,
}: ModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
    };

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in"
            onClick={(e) => {
                if (e.target === overlayRef.current) onClose();
            }}
        >
            <div
                className={cn(
                    'w-full bg-soar-bg-secondary rounded-xl border border-soar-border shadow-2xl animate-slide-in',
                    sizeClasses[size]
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-soar-border">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-white hover:bg-soar-card rounded transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">{children}</div>

                {/* Footer */}
                {footer && (
                    <div className="px-6 py-4 border-t border-soar-border flex justify-end gap-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
