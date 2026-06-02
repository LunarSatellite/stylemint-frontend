import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { SsoCallback } from '@/auth/SsoCallback'
import { RequireAuth, RequireRole } from '@/auth/guards'
import { AppShell } from '@/layouts/AppShell'

const LoginPage            = lazy(() => import('@/pages/LoginPage'))
const KycQueuePage         = lazy(() => import('@/pages/KycQueuePage'))
const KycDetailPage        = lazy(() => import('@/pages/KycDetailPage'))
const ModerationQueuePage  = lazy(() => import('@/pages/ModerationQueuePage'))
const ModerationDetailPage = lazy(() => import('@/pages/ModerationDetailPage'))
const AuditLogPage         = lazy(() => import('@/pages/AuditLogPage'))
const FeatureFlagsPage     = lazy(() => import('@/pages/FeatureFlagsPage'))
const FeatureFlagDetailPage= lazy(() => import('@/pages/FeatureFlagDetailPage'))
const PlatformConfigPage   = lazy(() => import('@/pages/PlatformConfigPage'))
const PayoutOverridesPage  = lazy(() => import('@/pages/PayoutOverridesPage'))
const IssueRefundPage      = lazy(() => import('@/pages/IssueRefundPage'))
const AdminAccountsPage    = lazy(() => import('@/pages/AdminAccountsPage'))
const AdminDetailPage      = lazy(() => import('@/pages/AdminDetailPage'))
const MySessionsPage       = lazy(() => import('@/pages/MySessionsPage'))
const MfaSetupPage         = lazy(() => import('@/pages/MfaSetupPage'))
const NotFoundPage         = lazy(() => import('@/pages/NotFoundPage'))

function Page({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="p-6 text-text-muted">Loading…</div>}>{children}</Suspense>
}

export const router = createBrowserRouter([
  { path: '/login',        element: <Page><LoginPage /></Page> },
  { path: '/sso/callback', element: <SsoCallback /> },
  {
    element: <RequireAuth><AppShell /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/kyc" replace /> },
      { path: '/kyc',              element: <RequireRole roles={['KycReviewer','SuperAdmin','Readonly']}><Page><KycQueuePage /></Page></RequireRole> },
      { path: '/kyc/:id',          element: <Page><KycDetailPage /></Page> },
      { path: '/moderation',       element: <RequireRole roles={['ContentMod','SuperAdmin']}><Page><ModerationQueuePage /></Page></RequireRole> },
      { path: '/moderation/:id',   element: <RequireRole roles={['ContentMod','SuperAdmin']}><Page><ModerationDetailPage /></Page></RequireRole> },
      { path: '/audit',            element: <Page><AuditLogPage /></Page> },
      { path: '/feature-flags',    element: <Page><FeatureFlagsPage /></Page> },
      { path: '/feature-flags/:key', element: <Page><FeatureFlagDetailPage /></Page> },
      { path: '/platform-config',  element: <Page><PlatformConfigPage /></Page> },
      { path: '/payouts',          element: <Page><PayoutOverridesPage /></Page> },
      { path: '/refunds',          element: <Page><IssueRefundPage /></Page> },
      { path: '/admins',           element: <RequireRole roles={['SuperAdmin']}><Page><AdminAccountsPage /></Page></RequireRole> },
      { path: '/admins/:id',       element: <Page><AdminDetailPage /></Page> },
      { path: '/me/sessions',      element: <Page><MySessionsPage /></Page> },
      { path: '/settings/mfa',     element: <Page><MfaSetupPage /></Page> },
      { path: '*',                 element: <Page><NotFoundPage /></Page> },
    ],
  },
])
