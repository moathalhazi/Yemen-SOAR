'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/stores';

interface WebSocketMessage {
    type: 'alert' | 'incident' | 'playbook' | 'evidence' | 'risk' | 'system' | 'notification';
    action: 'created' | 'updated' | 'deleted' | 'executed' | 'collected' | 'triggered' | 'pong' | 'received';
    data: unknown;
    timestamp: string;
}

interface UseWebSocketOptions {
    url?: string;
    reconnectAttempts?: number;
    reconnectInterval?: number;
    onMessage?: (message: WebSocketMessage) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
    const {
        url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws',
        reconnectAttempts = 5,
        reconnectInterval = 3000,
        onMessage,
    } = options;

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectCountRef = useRef(0);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

    const { addNotification } = useUIStore();

    const normalizeMessage = useCallback((raw: any): WebSocketMessage | null => {
        if (raw?.type && raw?.action) {
            return raw as WebSocketMessage;
        }

        if (raw?.event) {
            const legacyMap: Record<string, Pick<WebSocketMessage, 'type' | 'action'>> = {
                alert_created: { type: 'alert', action: 'created' },
                incident_created: { type: 'incident', action: 'created' },
                incident_updated: { type: 'incident', action: 'updated' },
                playbook_executed: { type: 'playbook', action: 'executed' },
                evidence_collected: { type: 'evidence', action: 'collected' },
                high_risk_alert: { type: 'risk', action: 'triggered' },
            };

            const mapped = legacyMap[raw.event];
            if (!mapped) {
                return null;
            }

            return {
                type: mapped.type,
                action: mapped.action,
                data: raw.data ?? {},
                timestamp: raw.timestamp ?? new Date().toISOString(),
            };
        }

        return null;
    }, []);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            wsRef.current = new WebSocket(url);

            wsRef.current.onopen = () => {
                setIsConnected(true);
                reconnectCountRef.current = 0;
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const rawMessage = JSON.parse(event.data);
                    const message = normalizeMessage(rawMessage);
                    if (!message) {
                        return;
                    }

                    setLastMessage(message);

                    switch (message.type) {
                        case 'alert':
                            if (message.action === 'created') {
                                addNotification({
                                    type: 'warning',
                                    message: 'New alert received',
                                });
                            }
                            break;
                        case 'incident':
                            if (message.action === 'created') {
                                addNotification({
                                    type: 'error',
                                    message: 'New incident created',
                                });
                            }
                            break;
                        case 'playbook':
                            addNotification({
                                type: 'info',
                                message: `Playbook ${message.action}`,
                            });
                            break;
                        case 'evidence':
                            addNotification({
                                type: 'info',
                                message: 'New forensic evidence collected',
                            });
                            break;
                        case 'risk':
                            addNotification({
                                type: 'warning',
                                message: 'High risk alert threshold reached',
                            });
                            break;
                        case 'notification':
                            addNotification({
                                type: 'info',
                                message: String((message.data as { message?: string })?.message || 'Notification'),
                            });
                            break;
                        case 'system':
                            break;
                    }

                    onMessage?.(message);
                } catch (err) {
                    console.error('[WebSocket] Failed to parse message:', err);
                }
            };

            wsRef.current.onclose = () => {
                setIsConnected(false);

                if (reconnectCountRef.current < reconnectAttempts) {
                    reconnectCountRef.current++;
                    reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
                }
            };

            wsRef.current.onerror = (error) => {
                console.error('[WebSocket] Error:', error);
            };
        } catch (err) {
            console.error('[WebSocket] Connection failed:', err);
        }
    }, [url, reconnectAttempts, reconnectInterval, onMessage, addNotification, normalizeMessage]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
    }, []);

    const send = useCallback((data: unknown) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    useEffect(() => {
        connect();
        return () => disconnect();
    }, [connect, disconnect]);

    return {
        isConnected,
        lastMessage,
        send,
        connect,
        disconnect,
    };
}

export default useWebSocket;
