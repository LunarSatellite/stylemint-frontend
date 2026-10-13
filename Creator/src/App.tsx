import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Center, Loader, MantineProvider, localStorageColorSchemeManager } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ApiError } from './api/client';
import { bootstrap } from './auth/session';
import { useSession } from './auth/useSession';
import { Shell } from './components/Shell';
import { ApplicationStatusPage } from './features/auth/ApplicationStatusPage';
import { CreatePasswordPage } from './features/auth/CreatePasswordPage';
import { LoginPage } from './features/auth/LoginPage';
import { cssVariables, theme } from './theme';

const HomePage = lazy(() => import('./features/home/HomePage'));
const ReelsPage = lazy(() => import('./features/reels/ReelsPage'));
const ImportReelPage = lazy(() => import('./features/reels/ImportReelPage'));
const ReelDetailPage = lazy(() => import('./features/reels/ReelDetailPage'));
const StudioPage = lazy(() => import('./features/studio/StudioPage'));
const AnalyticsPage = lazy(() => import('./features/analytics/AnalyticsPage'));
const PartnershipsPage = lazy(() => import('./features/partnerships/PartnershipsPage'));
const PartnershipDetailPage = lazy(() => import('./features/partnerships/PartnershipDetailPage'));
const BrandsPage = lazy(() => import('./features/partnerships/BrandsPage'));
const BriefsPage = lazy(() => import('./features/partnerships/BriefsPage'));
const BriefDetailPage = lazy(() => import('./features/partnerships/BriefDetailPage'));
const DealsPage = lazy(() => import('./features/partnerships/DealsPage'));
const RateCardPage = lazy(() => import('./features/partnerships/RateCardPage'));
const EarningsPage = lazy(() => import('./features/money/EarningsPage'));
const PayoutsPage = lazy(() => import('./features/money/PayoutsPage'));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage'));
const CollectionsPage = lazy(() => import('./features/profile/CollectionsPage'));
const CollectionDetailPage = lazy(() => import('./features/profile/CollectionDetailPage'));
const SocialAccountsPage = lazy(() => import('./features/profile/SocialAccountsPage'));
const GrowthPage = lazy(() => import('./features/profile/GrowthPage'));
const CommunityPage = lazy(() => import('./features/community/CommunityPage'));
const AudioPage = lazy(() => import('./features/community/AudioPage'));
const ActivityPage = lazy(() => import('./features/activity/ActivityPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const NotFoundPage = lazy(() => import('./features/NotFoundPage'));

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        // Fail fast on 4xx: the answer will not change by asking again.
        retry: (count, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return count < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

const colorSchemeManager = localStorageColorSchemeManager({ key: 'sm.creator.colorScheme' });

function FullScreenLoader() {
  return (
    <Center mih="100vh">
      <Loader color="forest" />
    </Center>
  );
}

type GateStatus = 'signedIn' | 'needsPassword' | 'notCreator';

/** Where a signed-in status belongs. */
const homeFor: Record<GateStatus, string> = {
  needsPassword: '/create-password',
  notCreator: '/application',
  signedIn: '/',
};

function RequireStatus({ status, children }: { status: GateStatus; children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  if (session.status === 'loading') return <FullScreenLoader />;
  if (session.status === 'signedOut') {
    const from = location.pathname + location.search;
    return <Navigate to="/login" replace state={from !== '/' ? { from } : undefined} />;
  }
  if (session.status !== status) return <Navigate to={homeFor[session.status]} replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  if (session.status === 'loading') return <FullScreenLoader />;
  if (session.status === 'signedOut') return <>{children}</>;
  const from = (location.state as { from?: string } | null)?.from;
  const target = session.status === 'signedIn' && from ? from : homeFor[session.status];
  return <Navigate to={target} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/create-password"
        element={
          <RequireStatus status="needsPassword">
            <CreatePasswordPage />
          </RequireStatus>
        }
      />
      <Route
        path="/application"
        element={
          <RequireStatus status="notCreator">
            <ApplicationStatusPage />
          </RequireStatus>
        }
      />
      <Route
        element={
          <RequireStatus status="signedIn">
            <Shell />
          </RequireStatus>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="reels" element={<ReelsPage />} />
        <Route path="reels/import" element={<ImportReelPage />} />
        <Route path="reels/:id" element={<ReelDetailPage />} />
        <Route path="studio" element={<StudioPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="partnerships" element={<PartnershipsPage />} />
        <Route path="partnerships/:id" element={<PartnershipDetailPage />} />
        <Route path="brands" element={<BrandsPage />} />
        <Route path="briefs" element={<BriefsPage />} />
        <Route path="briefs/:id" element={<BriefDetailPage />} />
        <Route path="deals" element={<DealsPage />} />
        <Route path="rate-card" element={<RateCardPage />} />
        <Route path="earnings" element={<EarningsPage />} />
        <Route path="payouts" element={<PayoutsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="collections/:id" element={<CollectionDetailPage />} />
        <Route path="social" element={<SocialAccountsPage />} />
        <Route path="growth" element={<GrowthPage />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="audio" element={<AudioPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export function Providers({ children, client }: { children: ReactNode; client: QueryClient }) {
  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariables}
      defaultColorScheme="light"
      colorSchemeManager={colorSchemeManager}
    >
      <QueryClientProvider client={client}>
        <ModalsProvider>
          <Notifications position="top-right" zIndex={1000} />
          {children}
        </ModalsProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
}

const queryClient = createQueryClient();

export default function App() {
  const session = useSession();
  useEffect(() => {
    void bootstrap();
  }, []);
  useEffect(() => {
    // Nothing cached from one creator may be shown to the next.
    if (session.status === 'signedOut') queryClient.clear();
  }, [session.status]);

  return (
    <Providers client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Suspense fallback={<FullScreenLoader />}>
          <AppRoutes />
        </Suspense>
      </BrowserRouter>
    </Providers>
  );
}
