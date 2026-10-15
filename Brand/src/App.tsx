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
const OrdersPage = lazy(() => import('./features/orders/OrdersPage'));
const OrderDetailPage = lazy(() => import('./features/orders/OrderDetailPage'));
const PackingSlipsPage = lazy(() => import('./features/orders/PackingSlipsPage'));
const ProductsPage = lazy(() => import('./features/products/ProductsPage'));
const ProductEditorPage = lazy(() => import('./features/products/ProductEditorPage'));
const DeliveryPage = lazy(() => import('./features/delivery/DeliveryPage'));
const PayoutsPage = lazy(() => import('./features/payouts/PayoutsPage'));
const EmiRequestsPage = lazy(() => import('./features/emi/EmiRequestsPage'));
const CarePage = lazy(() => import('./features/care/CarePage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const SecurityPage = lazy(() => import('./features/settings/SecurityPage'));
const NotFoundPage = lazy(() => import('./features/NotFoundPage'));
// Customers & CRM (OmniFlow CRM workspace per seller, see features/crm/session.ts).
const CrmLayout = lazy(() => import('./features/crm/components').then((m) => ({ default: m.CrmLayout })));
const CrmCustomersPage = lazy(() => import('./features/crm/CustomersPage'));
const CrmCustomerProfilePage = lazy(() => import('./features/crm/CustomerProfilePage'));
const CrmTasksPage = lazy(() => import('./features/crm/TasksPage'));
const CrmSegmentsPage = lazy(() => import('./features/crm/SegmentsPage'));
const CrmCampaignsPage = lazy(() => import('./features/crm/CampaignsPage'));
const CrmFeedbackPage = lazy(() => import('./features/crm/FeedbackPage'));
const CrmDealsPage = lazy(() => import('./features/crm/DealsPage'));
const CrmReportsPage = lazy(() => import('./features/crm/ReportsPage'));
// Insights (analytics). Charts are a further lazy chunk inside these pages.
const InsightsLayout = lazy(() => import('./features/insights/InsightsLayout'));
const InsightsSalesPage = lazy(() => import('./features/insights/SalesPage'));
const InsightsProductsPage = lazy(() => import('./features/insights/ProductsPage'));
const InsightsDemandPage = lazy(() => import('./features/insights/DemandPage'));
const InsightsReelsPage = lazy(() => import('./features/insights/ReelsPage'));
const InsightsCreatorsPage = lazy(() => import('./features/insights/CreatorsPage'));
const InsightsPromotionsPage = lazy(() => import('./features/insights/PromotionsPage'));
const InsightsCustomersPage = lazy(() => import('./features/insights/CustomersPage'));
// Creators: find creators, partnerships, agreements, briefs, retainers, approvals, payments.
const CreatorsLayout = lazy(() => import('./features/creators/components').then((m) => ({ default: m.CreatorsLayout })));
const FindCreatorsPage = lazy(() => import('./features/creators/FindCreatorsPage'));
const PartnershipsPage = lazy(() => import('./features/creators/PartnershipsPage'));
const AgreementsPage = lazy(() => import('./features/creators/AgreementsPage'));
const AgreementEditorPage = lazy(() => import('./features/creators/AgreementEditorPage'));
const AgreementDetailPage = lazy(() => import('./features/creators/AgreementDetailPage'));
const CreatorCampaignsPage = lazy(() => import('./features/creators/CampaignsPage'));
const RetainersPage = lazy(() => import('./features/creators/RetainersPage'));
const ApprovalsPage = lazy(() => import('./features/creators/ApprovalsPage'));
const CreatorPaymentsPage = lazy(() => import('./features/creators/PaymentsPage'));

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

const colorSchemeManager = localStorageColorSchemeManager({ key: 'sm.seller.colorScheme' });

function FullScreenLoader() {
  return (
    <Center mih="100vh">
      <Loader color="forest" />
    </Center>
  );
}

/** Where a signed-in status belongs. */
const homeFor: Record<string, string> = {
  needsPassword: '/create-password',
  notVendor: '/application',
  signedIn: '/',
};

function RequireStatus({ status, children }: { status: 'signedIn' | 'needsPassword' | 'notVendor'; children: ReactNode }) {
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
          <RequireStatus status="notVendor">
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
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/packing-slips" element={<PackingSlipsPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/new" element={<ProductEditorPage />} />
        <Route path="products/:id" element={<ProductEditorPage />} />
        <Route path="delivery" element={<DeliveryPage />} />
        <Route path="payouts" element={<PayoutsPage />} />
        <Route path="emi-requests" element={<EmiRequestsPage />} />
        <Route path="care" element={<CarePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/security" element={<SecurityPage />} />
        <Route path="crm" element={<CrmLayout />}>
          <Route index element={<Navigate to="customers" replace />} />
          <Route path="customers" element={<CrmCustomersPage />} />
          <Route path="customers/:id" element={<CrmCustomerProfilePage />} />
          <Route path="tasks" element={<CrmTasksPage />} />
          <Route path="segments" element={<CrmSegmentsPage />} />
          <Route path="campaigns" element={<CrmCampaignsPage />} />
          <Route path="feedback" element={<CrmFeedbackPage />} />
          <Route path="deals" element={<CrmDealsPage />} />
          <Route path="reports" element={<CrmReportsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="insights" element={<InsightsLayout />}>
          <Route index element={<Navigate to="sales" replace />} />
          <Route path="sales" element={<InsightsSalesPage />} />
          <Route path="products" element={<InsightsProductsPage />} />
          <Route path="demand" element={<InsightsDemandPage />} />
          <Route path="reels" element={<InsightsReelsPage />} />
          <Route path="creators" element={<InsightsCreatorsPage />} />
          <Route path="promotions" element={<InsightsPromotionsPage />} />
          <Route path="customers" element={<InsightsCustomersPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="creators" element={<CreatorsLayout />}>
          <Route index element={<Navigate to="partnerships" replace />} />
          <Route path="find" element={<FindCreatorsPage />} />
          <Route path="partnerships" element={<PartnershipsPage />} />
          <Route path="agreements" element={<AgreementsPage />} />
          <Route path="agreements/new" element={<AgreementEditorPage mode="new" />} />
          <Route path="agreements/:id" element={<AgreementDetailPage />} />
          <Route path="agreements/:id/edit" element={<AgreementEditorPage mode="edit" />} />
          <Route path="agreements/:id/amend" element={<AgreementEditorPage mode="amend" />} />
          <Route path="campaigns" element={<CreatorCampaignsPage />} />
          <Route path="retainers" element={<RetainersPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="payments" element={<CreatorPaymentsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
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
    // Nothing cached from one seller may be shown to the next.
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
