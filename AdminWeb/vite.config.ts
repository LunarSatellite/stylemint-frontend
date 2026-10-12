/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Served from https://stylemint.voyageritnepal.com/admin/ - the same origin as the API, so requests go to
 * `/v1/...` with no base URL and no CORS. In development the API is proxied to the same path.
 */
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5180,
    proxy: {
      '/v1': { target: process.env.VITE_DEV_API ?? 'https://stylemint.voyageritnepal.com', changeOrigin: true, secure: true },
    },
  },
  build: {
    target: 'es2022',
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
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
});
