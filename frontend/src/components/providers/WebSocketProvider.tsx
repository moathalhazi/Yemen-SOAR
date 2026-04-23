'use client';

import { createContext, useContext, ReactNode, useCallback } from 'react';
import { useWebSocket } from '@/hooks';
import { useAlertsStore, useIncidentsStore } from '@/stores';

interface WebSocketContextType {
    isConnected: boolean;
    send: (data: unknown) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
    isConnected: false,
    send: () => { },
});

export function WebSocketProvider({ children }: { children: ReactNode }) {
    const { addAlert, updateAlert } = useAlertsStore();
    const { addIncident, updateIncident } = useIncidentsStore();

    const handleMessage = useCallback((message: any) => {
        if (!message || !message.type || !message.action || !message.data) return;

        switch (message.type) {
            case 'alert':
                if (message.action === 'created') addAlert(message.data);
                else if (message.action === 'updated') updateAlert(message.data.id, message.data);
                break;
            case 'incident':
                if (message.action === 'created') addIncident(message.data);
                else if (message.action === 'updated') updateIncident(message.data.id, message.data);
                break;
        }
    }, [addAlert, updateAlert, addIncident, updateIncident]);

    const { isConnected, send } = useWebSocket({
        onMessage: handleMessage
    });

    return (
        <WebSocketContext.Provider value={{ isConnected, send }}>
            {children}
        </WebSocketContext.Provider>
    );
}

export function useWebSocketContext() {
    return useContext(WebSocketContext);
}

export default WebSocketProvider;
