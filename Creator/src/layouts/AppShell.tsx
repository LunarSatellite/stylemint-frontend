import { NavLink, Outlet } from 'react-router-dom'
import {
  BarChart2,
  Activity,
  BookOpen,
  Layers,
  Video,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/auth/store'
import { broadcastLogout } from '@/auth/broadcastLogout'

const nav = [
  { to: '/analytics', label: 'Analytics', icon: BarChart2 },
  { to: '/studio',    label: 'Studio',    icon: Video },
  { to: '/story-arcs', label: 'Story Arcs', icon: Layers },
  { to: '/recipes',   label: 'Recipes',   icon: BookOpen },
  { to: '/activity',  label: 'Activity',  icon: Activity },
]

export function AppShell() {
  const clear = useAuth((s) => s.clear)

  function handleLogout() {
    clear()
    broadcastLogout()
    window.location.replace('/login')
  }

  return (
    <div className="flex h-full">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-bg-primary">
        Skip to main content
      </a>

      <nav className="flex w-56 shrink-0 flex-col border-r border-subtle bg-bg-secondary px-3 py-6" aria-label="Main navigation">
        <div className="mb-8 px-3">
          <span className="text-lg font-bold text-primary">StyleMint</span>
        </div>

        <ul className="flex flex-col gap-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-surface-2 text-text-primary'
                      : 'text-text-muted hover:bg-surface-1 hover:text-text-secondary'
                  }`
                }
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mt-auto">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-muted transition-colors hover:bg-surface-1 hover:text-text-secondary"
          >
            <LogOut size={16} aria-hidden="true" />
            Log out
          </button>
        </div>
      </nav>

      <main id="main-content" className="flex-1 overflow-y-auto bg-bg-primary p-6">
        <Outlet />
      </main>
    </div>
  )
}

export function AppShellSkeleton() {
  return (
    <div className="flex h-full animate-pulse">
      <div className="w-56 shrink-0 bg-bg-secondary" />
      <div className="flex-1 bg-bg-primary" />
    </div>
  )
}
