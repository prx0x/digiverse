import { createContext } from 'react';

export type WebSocketStatus = 'connected' | 'connecting' | 'disconnected';

export interface WebSocketEvent<T = unknown> {
  event: string;
  payload: T;
  timestamp: string;
}

export type EventHandler<T = unknown> = (payload: T, timestamp: string) => void;

export interface WebSocketContextValue {
  status: WebSocketStatus;
  subscribe: <T = unknown>(eventName: string, handler: EventHandler<T>) => () => void;
  latencyMs: number | null;
}

export const WebSocketContext = createContext<WebSocketContextValue | null>(null);
