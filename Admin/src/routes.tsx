import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { RequireAuth } from '@/auth/guards';
import { KycQueuePage } from '@/features/kyc/KycQueuePage';
import { ModerationQueuePage } from '@/features/moderation/ModerationQueuePage';
import { AdminAccountsPage } from '@/features/admins/AdminAccountsPage';
import { AuditLogPage } from '@/features/audit/AuditLogPage';
import { FeatureFlagsPage } from '@/features/flags/FeatureFlagsPage';
import { MySecurityPage } from '@/features/security/MySecurityPage';
import { AudioPage } from '@/features/audio/AudioPage';
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
      { path: 'moderation', element: <ModerationQueuePage /> },
      { path: 'audio', element: <AudioPage /> },
      // Payouts has four actions in the API and no list endpoint to
      // hang them on, so there is nothing honest to render yet.
      { path: 'payouts', element: <NotBuiltYet name="Payouts" /> },
      { path: 'admins', element: <AdminAccountsPage /> },
      { path: 'flags', element: <FeatureFlagsPage /> },
      { path: 'audit', element: <AuditLogPage /> },
      { path: 'settings/mfa', element: <MySecurityPage /> },
      { path: 'forbidden', element: <NotBuiltYet name="Not permitted" /> },
    ],
  },
]);
