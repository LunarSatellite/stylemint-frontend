import { useAuth } from './store';

/**
 * Sign every tab out together.
 *
 * An operator with the queue open in three tabs who logs out of one
 * has, without this, two tabs still holding a live token in memory and
 * still able to act. Called once from main.tsx.
 */
export function initBroadcastLogout(): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const channel = new BroadcastChannel('auth');

  const unsubscribe = useAuth.subscribe((state, previous) => {
    if (previous.token && !state.token) channel.postMessage({ type: 'logout' });
  });

  channel.onmessage = (event: MessageEvent) => {
    if ((event.data as { type?: string } | null)?.type === 'logout') {
      // Set directly, so reacting to the broadcast does not rebroadcast.
      useAuth.setState({ token: null, claims: null });
    }
  };

  return () => {
    unsubscribe();
    channel.close();
  };
}
