import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Bundled, not fetched from a CDN: sellers are often on slow mobile data.
import '@fontsource-variable/inter';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';
import './index.css';

import App from './App';

// A tab left open across a release: reload once when a lazy page chunk has gone.
window.addEventListener('vite:preloadError', () => {
  const key = 'sm.seller.reloadedForChunk';
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, '1');
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
