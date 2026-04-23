'use client';

import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';

interface ChatMessageProps {
    content: string;
    role: 'user' | 'assistant';
    timestamp?: Date;
    isLoading?: boolean;
}

/**
 * ChatMessage - Individual message bubble in the chat
 * Differentiates between user and AI assistant messages
 */
export default function ChatMessage({ content, role, timestamp, isLoading }: ChatMessageProps) {
    const isUser = role === 'user';

    return (
        <div className={cn(
            'flex gap-3 p-3',
            isUser ? 'flex-row-reverse' : 'flex-row'
        )}>
            {/* Avatar */}
            <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                isUser ? 'bg-soar-accent' : 'bg-gradient-to-r from-blue-600 to-purple-600'
            )}>
                {isUser ? (
                    <User className="w-4 h-4 text-white" />
                ) : (
                    <Bot className="w-4 h-4 text-white" />
                )}
            </div>

            {/* Message Content */}
            <div className={cn(
                'max-w-[80%] rounded-xl px-4 py-2',
                isUser
                    ? 'bg-soar-accent text-white rounded-br-sm'
                    : 'bg-soar-bg-secondary text-slate-900 dark:text-slate-200 rounded-bl-sm border border-soar-border'
            )}>
                {isLoading ? (
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                ) : (
                    <>
                        <p className="text-sm whitespace-pre-wrap">{content}</p>
                        {timestamp && (
                            <p className={cn(
                                'text-xs mt-1',
                                isUser ? 'text-white/70' : 'text-slate-500'
                            )}>
                                {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
