import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes, createQueryClient, Providers } from './App';
import { bootstrap } from './auth/session';
import './styles.css';

void bootstrap();

const client = createQueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers client={client}>
      <BrowserRouter basename="/shop">
        <AppRoutes />
      </BrowserRouter>
    </Providers>
  </StrictMode>,
);

// Installable PWA: the service worker caches only the app shell (contract A7).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/shop/sw.js', { scope: '/shop/' }).catch(() => undefined);
  });
}
