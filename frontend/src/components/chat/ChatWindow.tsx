'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, AlertCircle } from 'lucide-react';
import ChatMessage from './ChatMessage';
import { cn } from '@/lib/utils';
import { chatApi } from '@/lib/api';
import { useTranslationStore } from '@/stores/i18nStore';

interface Message {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: Date;
    isLoading?: boolean;
}

/**
 * ChatWindow - Main chat interface with message history
 * Handles message input, sending, and response display
 */
export default function ChatWindow() {
    const { t } = useTranslationStore();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Initialize with welcome message once
    useEffect(() => {
        setMessages([{
            id: 'welcome',
            content: t('chat.welcome'),
            role: 'assistant',
            timestamp: new Date()
        }]);
    }, [t]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
        }
    }, [input]);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            content: input.trim(),
            role: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            // Send to backend API
            const data = await chatApi.message(userMessage.content, {});

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                content: data.response,
                role: 'assistant',
                timestamp: new Date()
            };

            setMessages(prev => [...prev, aiMessage]);
        } catch (err: any) {
            console.error('Chat error:', err);
            setError(err.message || t('chat.error'));

            // Add error message
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                content: t('chat.errorPrefix', { error: err.message }),
                role: 'assistant',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearChat = () => {
        setMessages([{
            id: 'welcome',
            content: t('chat.welcome'),
            role: 'assistant',
            timestamp: new Date()
        }]);
        setError(null);
    };

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto bg-soar-bg-primary">
                {messages.map((message) => (
                    <ChatMessage
                        key={message.id}
                        content={message.content}
                        role={message.role}
                        timestamp={message.timestamp}
                    />
                ))}

                {/* Loading indicator */}
                {isLoading && (
                    <ChatMessage
                        content=""
                        role="assistant"
                        isLoading={true}
                    />
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Error Banner */}
            {error && (
                <div className="px-3 py-2 bg-red-500/10 border-t border-red-500/20 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <p className="text-xs text-red-400">{error}</p>
                </div>
            )}

            {/* Input Area */}
            <div className="p-3 border-t border-soar-border bg-soar-card">
                <div className="flex items-end gap-2">
                    {/* Clear button */}
                    <button
                        onClick={clearChat}
                        className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-soar-bg-secondary rounded-lg transition-colors"
                        title={t('chat.clear')}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Input */}
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('chat.placeholder')}
                            className={cn(
                                'w-full resize-none rounded-xl px-4 py-2 pe-12',
                                'bg-soar-bg-secondary border border-soar-border',
                                'text-slate-900 dark:text-white placeholder-slate-500',
                                'focus:outline-none focus:border-soar-accent',
                                'max-h-[120px] min-h-[40px] transition-all'
                            )}
                            rows={1}
                            disabled={isLoading}
                        />

                        {/* Send button */}
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || isLoading}
                            className={cn(
                                'absolute end-2 bottom-2 p-1.5 rounded-lg transition-colors',
                                input.trim() && !isLoading
                                    ? 'bg-soar-accent text-white hover:bg-blue-600'
                                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            )}
                        >
                            <Send className="w-4 h-4 rtl:-scale-x-100" />
                        </button>
                    </div>
                </div>

                <p className="text-xs text-slate-500 mt-2 text-center italic">
                    {t('chat.footer')}
                </p>
            </div>
        </div>
    );
}
