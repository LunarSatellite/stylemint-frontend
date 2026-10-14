import { useEffect, useRef, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { refresh as refreshSession, session } from '../auth/session';

/**
 * Live updates (same hub as Seller Center): SignalR `/hubs/notifications`, server→client method `live`
 * with `{ type, occurredUtc, data }`, plus `notification` for inbox items. On an event (debounced
 * ~300 ms) or a (re)connect, the creator's home, activity, partnership and money screens re-read
 * silently. Their normal refetch-on-focus stays the backstop, so a failed connection only costs freshness.
 */

export type LiveStatus = 'connecting' | 'connected' | 'offline';

interface LiveEvent {
  type?: string;
  data?: Record<string, unknown> | null;
}

/** Query-key roots a creator event can change. Anything unrecognised refreshes the inbox and home only. */
export const LIVE_KEYS = ['home', 'inbox', 'activity', 'partnerships', 'earnings', 'payouts', 'reels'] as const;

export function invalidateFor(qc: QueryClient, events: LiveEvent[]) {
  const types = events.map((e) => (e.type ?? '').toLowerCase());
  const roots = new Set<string>(['home', 'inbox']);
  for (const t of types) {
    if (!t) LIVE_KEYS.forEach((k) => roots.add(k));
    else if (t.includes('partner') || t.includes('campaign') || t.includes('brief')) roots.add('partnerships');
    else if (t.includes('earning') || t.includes('commission') || t.includes('tip')) roots.add('earnings');
    else if (t.includes('payout')) {
      roots.add('payouts');
      roots.add('earnings');
    } else if (t.includes('reel')) roots.add('reels');
    roots.add('activity');
  }
  roots.forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
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
        connection.on('notification', () => queue({ type: 'notification' }));
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

