import { Suspense, useState } from 'react'
import { Outlet, NavLink as RouterNavLink, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import {
  LayoutDashboard,
  TrendingUp,
  Zap,
  ScrollText,
  Wand2,
  Sparkles,
  HeartHandshake,
  ShoppingBag,
  PackageCheck,
  Inbox,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Compass,
  Rocket,
  Users2,
  Store,
  Boxes,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuth } from '@/auth/store'
import { cancelSilentRefresh } from '@/auth/silentRefresh'
import { broadcastLogout } from '@/auth/broadcastLogout'
import { api } from '@/api/client'

const prefetchMap: Record<string, () => Promise<unknown>> = {
  '/dashboard':   () => import('@/pages/DashboardPage'),
  '/briefs':      () => import('@/pages/BriefListPage'),
  '/analytics':   () => import('@/pages/AnalyticsPage'),
  '/activity':    () => import('@/pages/ActivityPage'),
  '/products':    () => import('@/pages/ProductsPage'),
  '/partnerships':() => import('@/pages/PartnershipsPage'),
  '/matches':     () => import('@/pages/MatchesPage'),
  '/sub-orders':  () => import('@/pages/SubOrdersPage'),
  '/recipes':     () => import('@/pages/RecipesPage'),
  '/inquiries':   () => import('@/pages/InquiriesPage'),
}

function NavItem({
  to,
  icon: Icon,
  label,
  collapsed,
}: {
  to: string
  icon: React.ElementType
  label: string
  collapsed: boolean
}) {
  return (
    <RouterNavLink
      to={to}
      title={collapsed ? label : undefined}
      onMouseEnter={() => prefetchMap[to]?.()}
      className="block w-full"
    >
      {({ isActive }) => (
        <span
          className={cn(
            'nav-item relative flex w-full items-center rounded-lg transition-all duration-150',
            collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2',
            isActive
              ? 'text-[var(--primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          )}
          style={isActive && !collapsed ? {
            background: 'var(--section-btn-bg)',
            boxShadow:  'inset 3px 0 0 var(--primary), inset 10px 0 16px rgba(0, 217, 138, 0.18)',
          } : undefined}
        >
          <span
            className={cn(
              'flex shrink-0 items-center justify-center rounded-md transition-all duration-150',
              collapsed ? 'h-8 w-8' : 'h-6 w-6',
              isActive ? 'text-[var(--primary)]' : 'text-current',
            )}
          >
            <Icon className="h-[15px] w-[15px]" aria-hidden="true" />
          </span>

          {!collapsed && (
            <span className="flex-1 text-sm font-medium">{label}</span>
          )}
        </span>
      )}
    </RouterNavLink>
  )
}

function SectionGroup({
  icon: Icon,
  iconColor,
  label,
  defaultOpen = true,
  collapsed,
  children,
}: {
  icon: React.ElementType
  iconColor: string
  label: string
  defaultOpen?: boolean
  collapsed: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-0.5 pt-2">
        <div
          title={label}
          className="mb-0.5 flex h-6 w-6 items-center justify-center rounded-md"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)' }}
        >
          <Icon className={cn('h-3 w-3', iconColor)} aria-hidden="true" />
        </div>
        {children}
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <button
        onClick={() => setOpen(!open)}
        className="section-header-btn flex w-full items-center gap-2.5 rounded-lg px-3 py-2"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)' }}
      >
        <Icon className={cn('section-icon h-3.5 w-3.5 shrink-0', iconColor)} aria-hidden="true" />
        <span className="section-label flex-1 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          {label}
        </span>
        <ChevronDown
          className={cn(
            'section-chevron h-3.5 w-3.5 shrink-0 transition-all duration-200',
            open ? 'rotate-0' : '-rotate-90',
          )}
          aria-hidden="true"
        />
      </button>

      <div
        className={cn(
          'flex flex-col gap-0.5 overflow-hidden transition-all duration-200',
          open ? 'max-h-96 pt-0.5 opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        {children}
      </div>
    </div>
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
  const navigate  = useNavigate()
  const claims    = useAuth((s) => s.claims)
  const [collapsed, setCollapsed] = useState(false)

  const emailHandle = claims?.email.split('@')[0] ?? ''
  const initials    = emailHandle.slice(0, 2).toUpperCase()

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
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'relative flex shrink-0 flex-col overflow-hidden transition-[width] duration-200 ease-in-out',
          collapsed ? 'w-16' : 'w-60',
        )}
        style={{
          background:  'var(--bg-secondary)',
          borderRight: '1px solid var(--border-primary)',
        }}
      >

        {/* ── Logo + toggle ─────────────────────────────────────────────── */}
        <div
          className="relative flex h-14 shrink-0 items-center px-3"
          style={{
            borderBottom: '1px solid var(--border-primary)',
            background:   'linear-gradient(90deg, var(--glow-soft) 0%, transparent 100%)',
          }}
        >
          {!collapsed && (
            <>
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-black tracking-tight"
                style={{
                  background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                  color:      'var(--bg-primary)',
                  boxShadow:  '0 0 14px var(--glow-primary)',
                }}
              >
                SM
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <p
                  className="text-sm font-bold inline-block"
                  style={{
                    background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--primary) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    lineHeight: 1.2,
                    paddingBottom: 2,
                  }}
                >StyleMint</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                  Brand Studio
                </p>
              </div>
            </>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'group relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200',
              collapsed ? 'mx-auto' : 'ml-auto',
            )}
            style={{
              background:  'linear-gradient(135deg, var(--surface-3) 0%, var(--surface-2) 100%)',
              border:      '1px solid var(--border-primary)',
              boxShadow:   '0 0 8px var(--glow-primary), inset 0 1px 0 rgba(255,255,255,0.06)',
              color:       'var(--primary)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 14px var(--glow-primary), inset 0 1px 0 rgba(255,255,255,0.08)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 8px var(--glow-primary), inset 0 1px 0 rgba(255,255,255,0.06)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-primary)'
            }}
          >
            {collapsed
              ? <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              : <ChevronLeft  className="h-3.5 w-3.5" aria-hidden="true" />
            }
          </button>
        </div>

        {/* ── Navigation ────────────────────────────────────────────────── */}
        <nav className="sm-nav-scroll flex flex-1 flex-col gap-1.5 overflow-y-auto px-2 py-3">

          <SectionGroup icon={Compass} iconColor="text-sky-400" label="Overview" collapsed={collapsed}>
            <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" collapsed={collapsed} />
            <NavItem to="/analytics" icon={TrendingUp}      label="Analytics" collapsed={collapsed} />
            <NavItem to="/activity"  icon={Zap}             label="Activity"  collapsed={collapsed} />
          </SectionGroup>

          <SectionGroup icon={Rocket} iconColor="text-orange-400" label="Campaign" collapsed={collapsed}>
            <NavItem to="/briefs"  icon={ScrollText} label="Briefs"  collapsed={collapsed} />
            <NavItem to="/recipes" icon={Wand2}      label="Recipes" collapsed={collapsed} />
          </SectionGroup>

          <SectionGroup icon={Users2} iconColor="text-pink-400" label="Creators" collapsed={collapsed}>
            <NavItem to="/matches"      icon={Sparkles}       label="Matches"      collapsed={collapsed} />
            <NavItem to="/partnerships" icon={HeartHandshake} label="Partnerships" collapsed={collapsed} />
          </SectionGroup>

          <SectionGroup icon={Store} iconColor="text-emerald-400" label="Catalog" collapsed={collapsed}>
            <NavItem to="/products" icon={ShoppingBag} label="Products" collapsed={collapsed} />
          </SectionGroup>

          <SectionGroup icon={Boxes} iconColor="text-teal-400" label="Fulfillment" collapsed={collapsed}>
            <NavItem to="/sub-orders" icon={PackageCheck} label="Sub-Orders" collapsed={collapsed} />
            <NavItem to="/inquiries"  icon={Inbox}        label="Inquiries"  collapsed={collapsed} />
          </SectionGroup>

          {claims?.role === 'admin' && (
            <SectionGroup icon={ShieldCheck} iconColor="text-red-400" label="Admin" collapsed={collapsed}>
              <NavItem to="/admin/goal-templates" icon={Settings} label="Goal Templates" collapsed={collapsed} />
            </SectionGroup>
          )}
        </nav>

        {/* ── User footer ───────────────────────────────────────────────── */}
        <div
          className="shrink-0 p-2"
          style={{ borderTop: '1px solid var(--border-primary)' }}
        >
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              <div
                title={claims?.email}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold"
                style={{
                  background: 'var(--surface-3)',
                  color:      'var(--text-secondary)',
                  border:     '1px solid var(--border-subtle)',
                }}
              >
                {initials}
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                aria-label="Sign out"
                className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-muted)] transition-all hover:bg-[var(--surface-2)] hover:text-red-400"
              >
                <LogOut className="h-[15px] w-[15px]" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              <div
                className="mb-2 flex items-center gap-2.5 rounded-lg px-2 py-2"
                style={{ background: 'var(--surface-1)' }}
              >
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{
                    background: 'var(--surface-3)',
                    color:      'var(--text-secondary)',
                    border:     '1px solid var(--border-subtle)',
                  }}
                >
                  {initials}
                </div>
                <p className="min-w-0 flex-1 truncate text-xs text-[var(--text-muted)]">
                  {claims?.email}
                </p>
              </div>

              <button
                onClick={handleLogout}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                  'text-[var(--text-secondary)] transition-all duration-150',
                  'hover:bg-[var(--surface-2)] hover:text-red-400',
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-150 group-hover:bg-red-500/10">
                  <LogOut className="h-[15px] w-[15px]" aria-hidden="true" />
                </span>
                Sign out
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
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
