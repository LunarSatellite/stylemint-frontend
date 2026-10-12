import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Bundled rather than fetched from a CDN, so the console looks the same on a bad connection.
import '@fontsource-variable/inter';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import './index.css';

import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
