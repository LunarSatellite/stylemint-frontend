import { lazy, Suspense, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Center, Loader, MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, RouterProvider, type RouteObject } from 'react-router-dom';
import { ApiError } from '@/api/errors';
import { loadConfig } from '@/config';
import { RequireAuth, RequireCapability, useAuth } from '@/auth/guards';
import type { Capability } from '@/auth/roles';
import { getSession, installSession, restoreSession, subscribe } from '@/auth/session';
import { colorSchemeManager } from '@/components/Chrome';
import { Shell } from '@/components/Shell';
import { LoginPage } from '@/features/auth/LoginPage';
import { SsoCallbackPage } from '@/features/auth/SsoCallbackPage';
import { SetPasswordPage } from '@/features/auth/SetPasswordPage';
import { AwaitingAccessPage } from '@/features/auth/AwaitingAccessPage';
import { NotFoundPage } from '@/features/NotFoundPage';
import { cssVariablesResolver, theme } from '@/theme';

function page(loader: () => Promise<Record<string, unknown>>, name: string) {
  return lazy(() => loader().then((m) => ({ default: m[name] as ComponentType })));
}

const DashboardPage = page(() => import('@/features/dashboard/DashboardPage'), 'DashboardPage');
const KycPage = page(() => import('@/features/kyc/KycPage'), 'KycPage');
const RidersPage = page(() => import('@/features/riders/RidersPage'), 'RidersPage');
const VendorsPage = page(() => import('@/features/vendors/VendorsPage'), 'VendorsPage');
const ProductsPage = page(() => import('@/features/products/ProductsPage'), 'ProductsPage');
const CustomersPage = page(() => import('@/features/customers/CustomersPage'), 'CustomersPage');
const OrdersPage = page(() => import('@/features/orders/OrdersPage'), 'OrdersPage');
const ReturnsPage = page(() => import('@/features/support/ReturnsPage'), 'ReturnsPage');
const TicketsPage = page(() => import('@/features/support/TicketsPage'), 'TicketsPage');
const PayoutsPage = page(() => import('@/features/payouts/PayoutsPage'), 'PayoutsPage');
const OrderCarePage = page(() => import('@/features/orders/OrderCarePage'), 'OrderCarePage');
const DeliveryPage = page(() => import('@/features/delivery/DeliveryPage'), 'DeliveryPage');
const ModerationPage = page(() => import('@/features/moderation/ModerationPage'), 'ModerationPage');
const ContentPage = page(() => import('@/features/content/ContentPage'), 'ContentPage');
const CampaignsPage = page(() => import('@/features/catalog/CampaignsPage'), 'CampaignsPage');
const CollectionsPage = page(() => import('@/features/catalog/CollectionsPage'), 'CollectionsPage');
const DiscoveryPage = page(() => import('@/features/catalog/DiscoveryPage'), 'DiscoveryPage');
const FeatureFlagsPage = page(() => import('@/features/platform/FeatureFlagsPage'), 'FeatureFlagsPage');
const PlatformConfigPage = page(() => import('@/features/platform/PlatformConfigPage'), 'PlatformConfigPage');
const AdminsPage = page(() => import('@/features/platform/AdminsPage'), 'AdminsPage');
const AuditPage = page(() => import('@/features/platform/AuditPage'), 'AuditPage');
const PrivacyPage = page(() => import('@/features/platform/PrivacyPage'), 'PrivacyPage');
const SecurityPage = page(() => import('@/features/security/SecurityPage'), 'SecurityPage');

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Retrying a 4xx only repeats the same refusal; transient failures get two more tries.
        retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      },
      mutations: { retry: false },
    },
  });
}

/** An operator with no roles can sign in (the server auto-registers them) but every call would be refused. */
function RolesGate() {
  const { roles } = useAuth();
  if (roles.length === 0) return <AwaitingAccessPage />;
  return <Shell />;
}

function guarded(capability: Capability, node: ReactNode) {
  return <RequireCapability capability={capability}>{node}</RequireCapability>;
}

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/sso/callback', element: <SsoCallbackPage /> },
  // Reset and invitation links: /admin/set-password?token=…
  { path: '/set-password', element: <SetPasswordPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <RolesGate />
      </RequireAuth>
    ),
    children: [
      { index: true, element: guarded('viewDashboard', <DashboardPage />) },
      { path: 'kyc', element: guarded('viewKyc', <KycPage />) },
      { path: 'riders', element: guarded('viewRiders', <RidersPage />) },
      { path: 'vendors', element: guarded('viewVendors', <VendorsPage />) },
      { path: 'products', element: guarded('viewProducts', <ProductsPage />) },
      { path: 'customers', element: guarded('viewCustomers', <CustomersPage />) },
      { path: 'orders', element: guarded('viewOrders', <OrdersPage />) },
      { path: 'orders/:orderNumber', element: guarded('viewOrders', <OrdersPage />) },
      { path: 'returns', element: guarded('viewSupport', <ReturnsPage />) },
      { path: 'support', element: guarded('viewSupport', <TicketsPage />) },
      { path: 'payouts', element: guarded('viewPayouts', <PayoutsPage />) },
      { path: 'order-care', element: guarded('orderCare', <OrderCarePage />) },
      { path: 'delivery', element: guarded('viewDelivery', <DeliveryPage />) },
      { path: 'moderation', element: guarded('viewModeration', <ModerationPage />) },
      { path: 'content', element: guarded('viewContent', <ContentPage />) },
      { path: 'campaigns', element: guarded('viewCatalogOps', <CampaignsPage />) },
      { path: 'collections', element: guarded('viewCatalogOps', <CollectionsPage />) },
      { path: 'discovery', element: guarded('viewCatalogOps', <DiscoveryPage />) },
      { path: 'feature-flags', element: guarded('viewFlags', <FeatureFlagsPage />) },
      { path: 'platform-config', element: guarded('viewConfig', <PlatformConfigPage />) },
      { path: 'admins', element: guarded('manageAdmins', <AdminsPage />) },
      { path: 'audit', element: guarded('viewAudit', <AuditPage />) },
      { path: 'privacy', element: guarded('viewDataRights', <PrivacyPage />) },
      { path: 'security', element: <SecurityPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];

export function Providers({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) {
  return (
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="light" colorSchemeManager={colorSchemeManager()}>
      <QueryClientProvider client={queryClient}>
        <ModalsProvider>
          <Notifications position="top-right" limit={4} />
          {children}
        </ModalsProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
}

const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';

export function App() {
  const [ready, setReady] = useState(false);
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(() => createBrowserRouter(routes, { basename }));

  useEffect(() => {
    installSession();
    restoreSession();
    void loadConfig().finally(() => setReady(true));
    // Nothing one operator loaded may be shown to the next one signing in on this tab.
    const off = subscribe(() => {
      if (!getSession()) queryClient.clear();
    });
    return () => {
      off();
    };
  }, [queryClient]);

  return (
    <Providers queryClient={queryClient}>
      {ready ? (
        <Suspense fallback={null}>
          <RouterProvider router={router} />
        </Suspense>
      ) : (
        <Center mih="100vh">
          <Loader color="forest" size="sm" aria-label="Loading" />
        </Center>
      )}
    </Providers>
  );
}

