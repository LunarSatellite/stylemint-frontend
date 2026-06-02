import { Suspense } from 'react'
import { Outlet, NavLink as RouterNavLink, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import {
  LayoutDashboard,
  FileText,
  BarChart2,
  Activity,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuth } from '@/auth/store'
import { cancelSilentRefresh } from '@/auth/silentRefresh'
import { broadcastLogout } from '@/auth/broadcastLogout'
import { api } from '@/api/client'

const prefetchMap: Record<string, () => Promise<unknown>> = {
  '/dashboard':  () => import('@/pages/DashboardPage'),
  '/briefs':     () => import('@/pages/BriefListPage'),
  '/analytics':  () => import('@/pages/AnalyticsPage'),
  '/activity':   () => import('@/pages/ActivityPage'),
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <RouterNavLink
      to={to}
      onMouseEnter={() => prefetchMap[to]?.()}
      className={({ isActive }) => cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </RouterNavLink>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-4 p-6">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-xl bg-[var(--surface-2)]" />
      ))}
    </div>
  )
}

export function AppShell() {
  const navigate = useNavigate()
  const claims = useAuth((s) => s.claims)

  async function handleLogout() {
    try { await api.post('/v1/auth/logout') } catch { /* ignore */ }
    finally {
      useAuth.getState().clear()
      cancelSilentRefresh()
      broadcastLogout()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        {/* Logo */}
        <div className="flex h-14 items-center border-b border-[var(--border-subtle)] px-4">
          <span className="text-base font-bold text-[var(--primary)]">StyleMint</span>
          <span className="ml-1 text-xs text-[var(--text-muted)]">Brand Studio</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          <NavItem to="/dashboard"  icon={LayoutDashboard} label="Dashboard"  />
          <NavItem to="/briefs"     icon={FileText}         label="Briefs"     />
          <NavItem to="/analytics"  icon={BarChart2}        label="Analytics"  />
          <NavItem to="/activity"   icon={Activity}         label="Activity"   />

          {claims?.role === 'admin' && (
            <>
              <div className="my-2 border-t border-[var(--border-subtle)]" />
              <NavItem to="/admin/goal-templates" icon={Settings} label="Goal Templates" />
            </>
          )}
        </nav>

        {/* User */}
        <div className="border-t border-[var(--border-subtle)] p-3">
          <div className="mb-2 px-3 py-1">
            <p className="truncate text-xs text-[var(--text-muted)]">{claims?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm',
              'text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-red-400',
            )}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            border:     '1px solid var(--border-subtle)',
            color:      'var(--text-primary)',
          },
        }}
      />
    </div>
  )
}
