import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './useAuth';
import {
  WebSocketContext,
  type EventHandler,
  type WebSocketStatus,
} from './WebSocketContext';

function getWebSocketUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL as string;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingSentTimeRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isUnmountedRef = useRef(false);

  const subscribe = useCallback(<T = unknown>(eventName: string, handler: EventHandler<T>) => {
    let handlers = handlersRef.current.get(eventName);
    if (!handlers) {
      handlers = new Set();
      handlersRef.current.set(eventName, handlers);
    }
    const genericHandler = handler as EventHandler;
    handlers.add(genericHandler);

    return () => {
      const currentHandlers = handlersRef.current.get(eventName);
      if (currentHandlers) {
        currentHandlers.delete(genericHandler);
        if (currentHandlers.size === 0) {
          handlersRef.current.delete(eventName);
        }
      }
    };
  }, []);

  useEffect(() => {
    isUnmountedRef.current = false;

    if (!user) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setStatus('disconnected');
      return;
    }

    function connect() {
      if (isUnmountedRef.current || !user) return;
      if (
        socketRef.current &&
        (socketRef.current.readyState === WebSocket.OPEN ||
          socketRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      setStatus('connecting');
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }
        setStatus('connected');
        reconnectAttemptsRef.current = 0;

        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            pingSentTimeRef.current = Date.now();
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 20000);
      };

      ws.onmessage = (messageEvent) => {
        try {
          const data = JSON.parse(messageEvent.data);
          if (data.type === 'pong') {
            if (pingSentTimeRef.current) {
              setLatencyMs(Date.now() - pingSentTimeRef.current);
              pingSentTimeRef.current = null;
            }
            return;
          }

          if (data.event) {
            const handlers = handlersRef.current.get(data.event);
            if (handlers) {
              for (const handler of handlers) {
                handler(data.payload, data.timestamp);
              }
            }
          }
        } catch {
          // ignore non-json messages
        }
      };

      ws.onerror = () => {
        // error will trigger onclose
      };

      ws.onclose = () => {
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        socketRef.current = null;
        if (isUnmountedRef.current || !user) {
          setStatus('disconnected');
          return;
        }

        setStatus('disconnected');
        const backoff = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, backoff);
      };
    }

    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [user]);

  return (
    <WebSocketContext.Provider value={{ status, subscribe, latencyMs }}>
      {children}
    </WebSocketContext.Provider>
  );
}
