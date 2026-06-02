import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    process.env['ANALYZE'] && visualizer({ open: true, gzipSize: true, brotliSize: true }),
  ].filter(Boolean),

  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':   ['react', 'react-dom', 'react-router-dom'],
          'vendor-query':   ['@tanstack/react-query', '@tanstack/react-virtual'],
          'vendor-echarts': ['echarts', 'echarts-for-react'],
          'vendor-table':   ['@tanstack/react-table'],
          'vendor-form':    ['react-hook-form', 'zod'],
          'vendor-radix':   [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
            '@radix-ui/react-tabs',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-switch',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-separator',
          ],
          'vendor-utils':   ['date-fns', 'date-fns-tz', 'axios', 'clsx', 'tailwind-merge', 'uuid'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
})
