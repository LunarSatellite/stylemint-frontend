import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { assertEnv } from './env';
import { initBroadcastLogout } from './auth/broadcastLogout';
import { seedDevToken } from './auth/devToken';
import { router } from './routes';
import './index.css';

assertEnv();
initBroadcastLogout();
seedDevToken();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Never retry what retrying cannot fix. A 401 needs a new token, a
      // 403 needs a different operator, a 404 needs a different id --
      // three more attempts produce three more of the same answer and
      // three times the load at the moment things are already wrong.
      retry: (count, err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status && [401, 403, 404].includes(status)) return false;
        return count < 2;
      },
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster theme="dark" position="bottom-right" />
    </QueryClientProvider>
  </StrictMode>,
);
