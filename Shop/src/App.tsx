import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from './api/client';
import { Layout, Loading } from './components/ui';
import BundlePage from './pages/BundlePage';
import CartPage from './pages/CartPage';
import LandingPage, { NotFoundPage } from './pages/LandingPage';
import ProductPage from './pages/ProductPage';
import ReelPage from './pages/ReelPage';
import StorePage from './pages/StorePage';
import { captureAttribution } from './shop/attribution';
import { restoreHandoff } from './shop/handoff';

// Pages reached after the first tap are split out of the initial bundle.
const SignInPage = lazy(() => import('./pages/SignInPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const PayReturnPage = lazy(() => import('./pages/PayReturnPage'));
const PlacedPage = lazy(() => import('./pages/PlacedPage'));

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ client, children }: { client: QueryClient; children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/**
 * Runs on every navigation: stores `?t=&ref=&utm_*` (contract A1) and redeems a `?restore=` cart hand-off token
 * (contract A4), then drops `restore` from the address bar so a reload never redeems it twice.
 */
function EntryEffects() {
  const location = useLocation();
  const navigate = useNavigate();
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    captureAttribution(location.pathname, location.search);
    const q = new URLSearchParams(location.search);
    const token = q.get('restore');
    if (token && token !== restoring) {
      setRestoring(token);
      q.delete('restore');
      const search = q.toString();
      void restoreHandoff(token).finally(() => {
        navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
      });
    }
  }, [location.pathname, location.search, navigate, restoring]);
  return null;
}

export function AppRoutes() {
  return (
    <>
      <EntryEffects />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<LandingPage />} />
            <Route path="r/:id" element={<ReelPage />} />
            <Route path="p/:id" element={<ProductPage />} />
            <Route path="b/:id" element={<BundlePage />} />
            <Route path="s/:id" element={<StorePage />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="signin" element={<SignInPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="pay/return" element={<PayReturnPage />} />
            <Route path="orders/:orderNumber/placed" element={<PlacedPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
