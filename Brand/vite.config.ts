import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Served at https://stylemint.voyageritnepal.com/seller/ — the API is the same origin (`/v1/...`),
// so there is no API base URL to configure. In development the dev server proxies the API paths to
// VITE_DEV_API (default: the production host). The seller CRM lives under `/api/v1/crm` on the same host.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_DEV_API || 'https://stylemint.voyageritnepal.com';
  return {
    base: '/seller/',
    plugins: [react()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5174,
      proxy: {
        '/v1': { target, changeOrigin: true, secure: true },
        // CRM (OmniFlow) API used by Customers & CRM.
        '/api': { target, changeOrigin: true, secure: true },
        '/hubs': { target, changeOrigin: true, secure: true, ws: true },
      },
    },
    build: {
      target: 'es2020',
      sourcemap: false,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            mantine: ['@mantine/core', '@mantine/hooks', '@mantine/notifications', '@mantine/modals'],
            query: ['@tanstack/react-query', 'zod'],
          },
        },
      },
    },
  };
});
