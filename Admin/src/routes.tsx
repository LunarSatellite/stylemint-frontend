import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { RequireAuth } from '@/auth/guards';
import { KycQueuePage } from '@/features/kyc/KycQueuePage';
import { LoginPage } from '@/features/auth/LoginPage';

/** A section that exists in the nav but has no screen yet. */
function NotBuiltYet({ name }: { name: string }) {
  return (
    <section>
      <h1 className="text-xl font-extrabold tracking-tight text-text-primary">{name}</h1>
      <p className="mt-2 text-sm text-text-muted">
        Not built yet. The endpoints exist; this screen does not.
      </p>
    </section>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/kyc" replace /> },
      { path: 'kyc', element: <KycQueuePage /> },
      { path: 'moderation', element: <NotBuiltYet name="Moderation" /> },
      { path: 'payouts', element: <NotBuiltYet name="Payouts" /> },
      { path: 'admins', element: <NotBuiltYet name="Admin accounts" /> },
      { path: 'flags', element: <NotBuiltYet name="Feature flags" /> },
      { path: 'audit', element: <NotBuiltYet name="Audit log" /> },
      { path: 'settings/mfa', element: <NotBuiltYet name="My security" /> },
      { path: 'forbidden', element: <NotBuiltYet name="Not permitted" /> },
    ],
  },
]);
