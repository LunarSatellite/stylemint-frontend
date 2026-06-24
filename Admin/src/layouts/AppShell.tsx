import { useState } from 'react'
import type { ReactNode } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { StepUpDialog } from '@/auth/StepUpDialog'
import { useLogout } from '@/api/mutations/useLogout'
import { useAuth } from '@/auth/store'
import { permissions } from '@/lib/permissions'
import type { LucideIcon } from 'lucide-react'
import {
  UserCheck, ShieldAlert, Wallet, RotateCcw,
  ScrollText, ToggleLeft, SlidersHorizontal,
  Users, Monitor, LogOut,
  ChevronLeft, ChevronRight, ChevronDown,
  ShieldCheck, Eye, BadgeDollarSign, Cpu, Crown, CircleUser,
  Flag, Clapperboard, Music2, FileText,
} from 'lucide-react'

// ── Nav data ──────────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: 'Review',
    icon: Eye,
    iconColor: 'text-sky-400',
    items: [
      { to: '/kyc',            label: 'KYC Review',      icon: UserCheck,  permission: 'canReviewKyc'       },
      { to: '/moderation',     label: 'Moderation',      icon: ShieldAlert, permission: 'canModerateContent' },
      { to: '/account-reports', label: 'Account Reports', icon: Flag,        permission: 'canModerateContent' },
    ],
  },
  {
    label: 'Content',
    icon: Clapperboard,
    iconColor: 'text-pink-400',
    items: [
      { to: '/audio', label: 'Audio', icon: Music2, permission: 'canModerateContent' },
    ],
  },
  {
    label: 'Finance',
    icon: BadgeDollarSign,
    iconColor: 'text-yellow-400',
    items: [
      { to: '/payouts', label: 'Payouts', icon: Wallet,    permission: 'canManagePayouts' },
      { to: '/refunds', label: 'Refunds', icon: RotateCcw, permission: 'canManagePayouts' },
    ],
  },
  {
    label: 'System',
    icon: Cpu,
    iconColor: 'text-purple-400',
    items: [
      { to: '/audit',             label: 'Audit Log',         icon: ScrollText,        permission: null                      },
      { to: '/feature-flags',     label: 'Feature Flags',     icon: ToggleLeft,        permission: 'canManageFlags'          },
      { to: '/platform-config',   label: 'Platform Config',   icon: SlidersHorizontal, permission: 'canManageFlags'          },
      { to: '/privacy-dashboard', label: 'Privacy Dashboard', icon: ShieldCheck,       permission: 'canViewPrivacyDashboard' },
      { to: '/policies',          label: 'Policies',          icon: FileText,          permission: 'canManageFlags'          },
    ],
  },
  {
    label: 'Admin',
    icon: Crown,
    iconColor: 'text-red-400',
    items: [
      { to: '/admins', label: 'Admin Accounts', icon: Users, permission: 'canManageAdmins' },
    ],
  },
  {
    label: 'Account',
    icon: CircleUser,
    iconColor: 'text-emerald-400',
    items: [
      { to: '/me/sessions', label: 'My Sessions', icon: Monitor, permission: null },
    ],
  },
]

// ── NavItem ───────────────────────────────────────────────────────────────────

function NavItem({
  to, label, icon: Icon, collapsed,
}: {
  to: string; label: string; icon: LucideIcon; collapsed: boolean
}) {
  return (
    <NavLink to={to} title={collapsed ? label : undefined} className="block w-full no-underline">
      {({ isActive }) => (
        <span
          className={[
            'nav-item relative flex w-full items-center rounded-lg transition-all duration-150',
            collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2',
            isActive ? 'text-primary' : 'text-text-secondary hover:text-text-primary',
          ].join(' ')}
          style={isActive && !collapsed ? {
            background: 'var(--section-btn-bg)',
            boxShadow:  'inset 3px 0 0 var(--primary), inset 10px 0 16px rgba(0, 217, 138, 0.18)',
          } : undefined}
        >
          <span
            className={[
              'flex shrink-0 items-center justify-center rounded-md transition-all duration-150',
              collapsed ? 'h-8 w-8' : 'h-6 w-6',
              isActive ? 'text-primary' : 'text-current',
            ].join(' ')}
          >
            <Icon className="h-[15px] w-[15px]" aria-hidden="true" />
          </span>
          {!collapsed && (
            <span className="flex-1 text-sm font-medium">{label}</span>
          )}
        </span>
      )}
    </NavLink>
  )
}

// ── SectionGroup ──────────────────────────────────────────────────────────────

function SectionGroup({
  icon: Icon, iconColor, label, defaultOpen = true, collapsed, children,
}: {
  icon: LucideIcon; iconColor: string; label: string
  defaultOpen?: boolean; collapsed: boolean; children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-0.5 pt-2">
        <div
          title={label}
          className="mb-0.5 flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.04]"
        >
          <Icon className={`h-3 w-3 ${iconColor}`} aria-hidden="true" />
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
        <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} aria-hidden="true" />
        <span className="section-label flex-1 text-left text-[10px] font-bold uppercase tracking-widest text-text-muted">
          {label}
        </span>
        <ChevronDown
          className={`section-chevron h-3.5 w-3.5 shrink-0 ${open ? 'rotate-0' : '-rotate-90'}`}
          aria-hidden="true"
        />
      </button>

      <div
        className={`flex flex-col gap-0.5 overflow-hidden transition-all duration-200 ${
          open ? 'max-h-96 pt-0.5 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {children}
      </div>
    </div>
  )
}

// ── AppShell ──────────────────────────────────────────────────────────────────

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const claims  = useAuth((s) => s.claims)
  const roles: string[] = claims?.roles ?? []
  const logout  = useLogout()
  const role        = roles[0] ?? 'Admin'
  const displayName = role.replace(/([A-Z])/g, ' $1').trim()
  const initial     = displayName.charAt(0).toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">

      {/* ── Sidebar ── */}
      <aside
        className={`relative flex shrink-0 flex-col overflow-hidden transition-[width] duration-200 ease-in-out ${
          collapsed ? 'w-16' : 'w-60'
        }`}
        style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-primary)' }}
      >

        {/* ── Logo + Toggle ── */}
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
                  className="inline-block pb-0.5 text-sm font-bold"
                  style={{
                    background:           'linear-gradient(135deg, var(--text-primary) 0%, var(--primary) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor:  'transparent',
                    backgroundClip:       'text',
                    lineHeight:           1.2,
                  }}
                >
                  StyleMint
                </p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                  Admin Portal
                </p>
              </div>
            </>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
              collapsed ? 'mx-auto' : 'ml-auto'
            }`}
            style={{
              background: 'linear-gradient(135deg, var(--surface-3) 0%, var(--surface-2) 100%)',
              border:     '1px solid var(--border-primary)',
              boxShadow:  '0 0 8px var(--glow-primary), inset 0 1px 0 rgba(255,255,255,0.06)',
              color:      'var(--primary)',
            }}
            onMouseEnter={e => {
              const btn = e.currentTarget
              btn.style.boxShadow  = '0 0 14px var(--glow-primary), inset 0 1px 0 rgba(255,255,255,0.08)'
              btn.style.borderColor = 'var(--primary)'
            }}
            onMouseLeave={e => {
              const btn = e.currentTarget
              btn.style.boxShadow  = '0 0 8px var(--glow-primary), inset 0 1px 0 rgba(255,255,255,0.06)'
              btn.style.borderColor = 'var(--border-primary)'
            }}
          >
            {collapsed
              ? <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              : <ChevronLeft  className="h-3.5 w-3.5" aria-hidden="true" />
            }
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className={`sm-nav-scroll flex flex-1 flex-col gap-1.5 overflow-y-auto py-3 ${collapsed ? 'px-1.5' : 'px-2'}`}>
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(({ permission }) =>
              !permission || permissions[permission as keyof typeof permissions](roles)
            )
            if (!visibleItems.length) return null
            return (
              <SectionGroup
                key={group.label}
                icon={group.icon}
                iconColor={group.iconColor}
                label={group.label}
                collapsed={collapsed}
              >
                {visibleItems.map(({ to, label, icon }) => (
                  <NavItem key={to} to={to} label={label} icon={icon} collapsed={collapsed} />
                ))}
              </SectionGroup>
            )
          })}
        </nav>

        {/* ── User Footer ── */}
        <div className="shrink-0 border-t border-white/[0.05] p-2">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              <div
                title={displayName}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-bg-primary"
              >
                {initial}
              </div>
              <button
                onClick={() => logout.mutate()}
                title="Sign out"
                aria-label="Sign out"
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-all hover:bg-white/[0.05] hover:text-red-400"
              >
                <LogOut className="h-[15px] w-[15px]" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-3 rounded-lg bg-white/[0.02] px-2 py-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-bg-primary">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-text-primary">{displayName}</p>
                  <p className="truncate text-[11px] text-text-muted">{role}</p>
                </div>
              </div>

              <button
                onClick={() => logout.mutate()}
                className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-all duration-150 hover:bg-white/[0.05] hover:text-red-400"
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

      {/* ── Main ── */}
      <main className="flex flex-1 flex-col overflow-hidden bg-bg-primary">
        <Outlet />
      </main>

      <StepUpDialog />
    </div>
  )
}
