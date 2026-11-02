import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { serviceWorker } from './pwa/swPlugin';

// Served at https://stylemint.voyageritnepal.com/shop/ by the API itself (ShopSpaEndpoints, contract A2).
// The API is the same origin (`/v1/...`), so there is no API base URL to configure. In development the dev
// server proxies the API paths to VITE_DEV_API (default: the production host).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_DEV_API || 'https://stylemint.voyageritnepal.com';
  return {
    base: '/shop/',
    plugins: [react(), serviceWorker()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5176,
      proxy: {
        '/v1': { target, changeOrigin: true, secure: true },
        '/payments': { target, changeOrigin: true, secure: true },
      },
    },
    build: {
      target: 'es2020',
      sourcemap: false,
      chunkSizeWarningLimit: 300,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            query: ['@tanstack/react-query'],
          },
        },
      },
    },
  };
});
