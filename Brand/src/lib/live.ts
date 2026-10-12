import { useEffect, useRef, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { refresh as refreshSession, session } from '../auth/session';

/**
 * Live order/delivery updates (realtime-contract.md): SignalR `/hubs/notifications`, server→client
 * method `live` with `{ type, occurredUtc, data }`. On an event (debounced ~300 ms) or a
 * (re)connect, open order/delivery screens re-read silently. Polling on those screens stays as the
 * backstop, so a failed connection only costs a few seconds of delay.
 */

export type LiveStatus = 'connecting' | 'connected' | 'offline';

interface LiveEvent {
  type?: string;
  data?: { subOrderId?: string | null; orderId?: string | null };
}

function invalidateFor(qc: QueryClient, events: LiveEvent[]) {
  const types = new Set(events.map((e) => e.type));
  if (types.has('order.updated') || types.has('delivery.updated') || types.size === 0) {
    void qc.invalidateQueries({ queryKey: ['orders'] });
    void qc.invalidateQueries({ queryKey: ['delivery'] });
    void qc.invalidateQueries({ queryKey: ['home'] });
  }
}

export function useLiveUpdates(): LiveStatus {
  const qc = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const pending = useRef<LiveEvent[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined' || import.meta.env.MODE === 'test') {
      setStatus('offline');
      return;
    }
    let stopped = false;
    let connection: import('@microsoft/signalr').HubConnection | null = null;

    const flush = () => {
      const batch = pending.current;
      pending.current = [];
      invalidateFor(qc, batch);
    };
    const queue = (e: LiveEvent) => {
      pending.current.push(e);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 300);
    };

    const start = async () => {
      try {
        const signalR = await import('@microsoft/signalr');
        if (stopped) return;
        connection = new signalR.HubConnectionBuilder()
          .withUrl('/hubs/notifications', {
            accessTokenFactory: async () => {
              const token = session.getAccessToken();
              if (token) return token;
              await refreshSession();
              return session.getAccessToken() ?? '';
            },
          })
          .withAutomaticReconnect([0, 2000, 5000, 10000, 30000, 60000])
          .configureLogging(signalR.LogLevel.None)
          .build();
        connection.on('live', (e: LiveEvent) => queue(e ?? {}));
        connection.on('notification', () => queue({ type: 'order.updated' }));
        connection.onreconnecting(() => setStatus('connecting'));
        connection.onreconnected(() => {
          setStatus('connected');
          queue({});
        });
        connection.onclose(() => {
          if (!stopped) setStatus('offline');
        });
        await connection.start();
        if (stopped) {
          void connection.stop();
          return;
        }
        setStatus('connected');
      } catch {
        if (!stopped) setStatus('offline');
      }
    };

    void start();

    const onVisible = () => {
      if (document.visibilityState === 'visible' && connection && String(connection.state) === 'Disconnected') {
        void connection.start().then(
          () => {
            setStatus('connected');
            queue({});
          },
          () => setStatus('offline'),
        );
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (timer.current) clearTimeout(timer.current);
      void connection?.stop();
    };
  }, [qc]);

  return status;
}

/** Polling interval for screens with moving orders — faster while live updates are down. */
export const POLL_MS = 30_000;
