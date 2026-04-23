'use client';

import { useState } from 'react';
import { MessageCircle, X, Minimize2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ChatWindow from './ChatWindow';
import { useTranslationStore } from '@/stores/i18nStore';

/**
 * ChatButton - Floating chat button for AI assistant
 * Positioned at bottom-right corner of the screen
 */
export default function ChatButton() {
    const { t } = useTranslationStore();
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    const toggleChat = () => {
        if (isMinimized) {
            setIsMinimized(false);
        } else {
            setIsOpen(!isOpen);
        }
    };

    return (
        <>
            {/* Floating Button */}
            {!isOpen && (
                <button
                    onClick={toggleChat}
                    className={cn(
                        'fixed bottom-6 ltr:right-6 rtl:left-6 z-50',
                        'w-14 h-14 rounded-full',
                        'bg-gradient-to-r from-soar-accent to-blue-600',
                        'flex items-center justify-center',
                        'shadow-lg shadow-soar-accent/25',
                        'hover:scale-110 transition-transform duration-200',
                        'animate-pulse hover:animate-none'
                    )}
                    title={t('chat.title')}
                >
                    <MessageCircle className="w-6 h-6 text-white" />
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className={cn(
                    'fixed z-50 transition-all duration-300',
                    isMinimized
                        ? 'bottom-6 end-6 w-72 h-14'
                        : 'bottom-6 end-6 w-96 h-[500px]'
                )}>
                    <div className={cn(
                        'bg-soar-card border border-soar-border rounded-xl overflow-hidden h-full',
                        'shadow-2xl shadow-black/50',
                        'flex flex-col'
                    )}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-soar-accent to-blue-600">
                            <div className="flex items-center gap-2">
                                <MessageCircle className="w-5 h-5 text-white" />
                                <span className="font-semibold text-white">{t('chat.title')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setIsMinimized(!isMinimized)}
                                    className="p-1 hover:bg-white/20 rounded transition-colors"
                                    title={isMinimized ? t('chat.maximize') : t('chat.minimize')}
                                >
                                    {isMinimized ? (
                                        <Maximize2 className="w-4 h-4 text-white" />
                                    ) : (
                                        <Minimize2 className="w-4 h-4 text-white" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 hover:bg-white/20 rounded transition-colors"
                                    title={t('chat.close')}
                                >
                                    <X className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        </div>

                        {/* Chat Content */}
                        {!isMinimized && <ChatWindow />}
                    </div>
                </div>
            )}
        </>
    );
}
