import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from './router'
import { queryClient } from './api/queryClient'
import { useAuth } from './auth/store'
import { cancelSilentRefresh } from './auth/silentRefresh'
import { subscribeBroadcastLogout } from './auth/broadcastLogout'

if (import.meta.env.DEV) {
  const DEV_TOKEN = [
    'eyJhbGciOiJIUzI1NiJ9',
    btoa(JSON.stringify({
      sub:   'dev-vendor-001',
      email: 'dev@stylemint.app',
      role:  'vendor',
      exp:   9999999999,
      iat:   1700000000,
    })),
    'dev-sig',
  ].join('.')
  useAuth.getState().setToken(DEV_TOKEN)
}

subscribeBroadcastLogout(() => {
  useAuth.getState().clear()
  cancelSilentRefresh()
  if (!window.location.pathname.startsWith('/login')) {
    window.location.replace('/login')
  }
})

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
