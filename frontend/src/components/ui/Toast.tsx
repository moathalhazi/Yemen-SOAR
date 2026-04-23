'use client';

import { useEffect, useState } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { useUIStore } from '@/stores';

interface Notification {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
}

const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

const colors = {
    success: 'bg-green-500/20 border-green-500/50 text-green-400',
    error: 'bg-red-500/20 border-red-500/50 text-red-400',
    warning: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
    info: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
};

interface ToastProps {
    notification: Notification;
    onClose: () => void;
}

function Toast({ notification, onClose }: ToastProps) {
    const Icon = icons[notification.type];

    // Auto-dismiss after 5 seconds
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div
            className={`flex items-center gap-3 p-4 rounded-lg border ${colors[notification.type]} animate-slide-up shadow-lg`}
        >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <p className="flex-1 text-sm">{notification.message}</p>
            <button
                onClick={onClose}
                className="text-current opacity-70 hover:opacity-100 transition-opacity"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

export function ToastContainer() {
    const { notifications, removeNotification } = useUIStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <div className="fixed bottom-4 end-4 z-50 flex flex-col gap-2 max-w-sm">
            {notifications.map((notification) => (
                <Toast
                    key={notification.id}
                    notification={notification}
                    onClose={() => removeNotification(notification.id)}
                />
            ))}
        </div>
    );
}

export default ToastContainer;
