import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { session, type SessionState } from './session';
import { authApi } from './api';

export function useSession(): SessionState {
  return useSyncExternalStore(session.subscribe, session.getState, session.getState);
}

/** The signed-in account's name, email and phone (the JWT carries none of them). */
export function useAccount() {
  const { accountId, status } = useSession();
  return useQuery({
    queryKey: ['account', accountId],
    queryFn: () => authApi.account(accountId!),
    enabled: !!accountId && status !== 'signedOut',
    staleTime: 5 * 60_000,
  });
}
