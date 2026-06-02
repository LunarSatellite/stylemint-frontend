import { Outlet, NavLink } from 'react-router-dom'
import { StepUpDialog } from '@/auth/StepUpDialog'
import { useLogout } from '@/api/mutations/useLogout'
import { useAuth } from '@/auth/store'
import { permissions } from '@/lib/permissions'
import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  UserCheck, ShieldAlert, Wallet, RotateCcw,
  ScrollText, ToggleLeft, SlidersHorizontal,
  Users, Monitor, KeyRound, LogOut,
  ChevronLeft, ChevronRight,
} from 'lucide-react'

// ── Nav config ────────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Review',
    items: [
      { to: '/kyc',        label: 'KYC Review',   icon: UserCheck,         permission: 'canReviewKyc'       },
      { to: '/moderation', label: 'Moderation',    icon: ShieldAlert,        permission: 'canModerateContent' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/payouts', label: 'Payouts', icon: Wallet,    permission: 'canManagePayouts' },
      { to: '/refunds', label: 'Refunds', icon: RotateCcw, permission: 'canManagePayouts' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/audit',           label: 'Audit Log',       icon: ScrollText,        permission: null             },
      { to: '/feature-flags',   label: 'Feature Flags',   icon: ToggleLeft,        permission: 'canManageFlags' },
      { to: '/platform-config', label: 'Platform Config', icon: SlidersHorizontal, permission: 'canManageFlags' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/admins', label: 'Admin Accounts', icon: Users, permission: 'canManageAdmins' },
    ],
  },
] as const

const BOTTOM_LINKS = [
  { to: '/me/sessions',  label: 'My Sessions', icon: Monitor  },
  { to: '/settings/mfa', label: 'MFA Setup',   icon: KeyRound },
] as const

// ── NavItem ───────────────────────────────────────────────────────────────────
function NavItem({
  to, label, icon: Icon, collapsed,
}: {
  to: string; label: string; icon: LucideIcon; collapsed: boolean
}) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className="mb-[1px] block no-underline group"
    >
      {({ isActive }) => (
        <div
          className={`relative flex cursor-pointer items-center gap-[10px] rounded-[9px] transition-[background] duration-[180ms] ${
            collapsed ? 'justify-center px-0 py-2' : 'justify-start py-2 pl-[14px] pr-[10px]'
          } ${isActive
              ? 'bg-[linear-gradient(90deg,rgba(0,217,138,0.13)_0%,rgba(0,217,138,0.03)_70%,transparent_100%)]'
              : 'hover:bg-white/[0.035]'
          }`}
        >
          {/* Left glow accent */}
          {!collapsed && (
            <div
              className={`absolute bottom-[5px] left-0 top-[5px] w-[3px] rounded-[0_3px_3px_0] transition-all duration-[180ms] ${
                isActive ? 'bg-primary shadow-[0_0_10px_rgba(0,217,138,0.7)]' : 'bg-transparent shadow-none'
              }`}
            />
          )}

          {/* Icon box */}
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] transition-[background] duration-[180ms] ${
              isActive ? 'bg-primary/15' : 'bg-transparent group-hover:bg-white/[0.05]'
            }`}
          >
            <Icon
              size={14}
              className={`transition-colors duration-[180ms] ${
                isActive ? 'text-primary' : 'text-[#4A7A6A] group-hover:text-text-secondary'
              }`}
            />
          </div>

          {/* Label + active dot */}
          {!collapsed && (
            <>
              <span
                className={`flex-1 overflow-hidden whitespace-nowrap text-[13px] transition-colors duration-[180ms] ${
                  isActive ? 'font-semibold text-primary' : 'font-normal text-text-muted group-hover:text-text-secondary'
                }`}
              >
                {label}
              </span>
              {isActive && (
                <div className="h-[5px] w-[5px] shrink-0 rounded-full bg-primary shadow-[0_0_6px_rgba(0,217,138,0.8)]" />
              )}
            </>
          )}
        </div>
      )}
    </NavLink>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) {
    return <div className="mx-2 mb-1.5 mt-[10px] h-px bg-white/[0.05]" />
  }
  return (
    <div className="mb-[2px] flex items-center gap-2 px-3 pb-1.5 pt-4">
      <div className="h-[4px] w-[4px] shrink-0 rounded-full bg-[#1E4A38]" />
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2A5040]">
        {label}
      </span>
      <div className="h-px flex-1 bg-white/[0.04]" />
    </div>
  )
}

// ── AppShell ──────────────────────────────────────────────────────────────────
export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)

  const claims   = useAuth((s) => s.claims)
  const roles: string[] = claims?.roles ?? []
  const logout   = useLogout()
  const email    = claims?.email ?? ''
  const handle   = email.split('@')[0]
  const initials = handle.slice(0, 2).toUpperCase()
  const role     = roles[0] ?? 'Admin'

  return (
    <div className="flex h-screen bg-bg-primary">

      {/* ── Sidebar ── */}
      <aside
        className={`flex shrink-0 flex-col overflow-hidden border-r border-white/[0.05] transition-[width] duration-[220ms] ease-[ease] ${
          collapsed ? 'w-[68px]' : 'w-60'
        }`}
        style={{ background: 'linear-gradient(180deg, #0C1A14 0%, var(--bg-primary) 100%)' }}
      >

        {/* ── Logo + Toggle ── */}
        <div className="shrink-0 border-b border-white/[0.05]">
          <div
            className={`flex items-center gap-[10px] ${
              collapsed ? 'justify-center px-0 pb-[10px] pt-[18px]' : 'justify-between px-4 pb-[10px] pt-5'
            }`}
          >
            {/* S icon */}
            <div
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border border-primary/20"
              style={{ background: '#0D2319', boxShadow: '0 0 16px rgba(0,217,138,0.1)' }}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path
                  d="M4 11 C4 7 6 3.5 11 3.5 C16 3.5 18 7 18 9.5 C18 12 16 13 11 13"
                  stroke="var(--primary)" strokeWidth="1.7" strokeLinecap="round" fill="none"
                />
                <path
                  d="M18 12.5 C18 16.5 16 18.5 11 18.5 C6 18.5 4 15 4 12.5 C4 10 6 9 11 9"
                  stroke="var(--primary)" strokeWidth="1.7" strokeLinecap="round" fill="none"
                />
                <circle cx="11" cy="11" r="1.3" fill="var(--primary)" />
              </svg>
            </div>

            {/* Name + badge */}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="whitespace-nowrap text-[16px] font-extrabold leading-[1.2] tracking-[-0.3px] text-text-primary">
                  StyleMint
                </div>
                <div className="mt-1 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-[1px] text-[9px] font-bold uppercase tracking-[0.1em] text-primary">
                  Admin Portal
                </div>
              </div>
            )}

            <ToggleBtn collapsed={collapsed} onClick={() => setCollapsed(c => !c)} />
          </div>
        </div>

        {/* ── Nav ── */}
        <nav
          className={`sm-nav-scroll flex-1 overflow-y-auto ${collapsed ? 'px-1.5 pt-1' : 'px-2 pt-1'}`}
        >
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(({ permission }) =>
              !permission || permissions[permission as keyof typeof permissions](roles)
            )
            if (!visibleItems.length) return null
            return (
              <div key={group.label}>
                <SectionLabel label={group.label} collapsed={collapsed} />
                {visibleItems.map(({ to, label, icon }) => (
                  <NavItem key={to} to={to} label={label} icon={icon} collapsed={collapsed} />
                ))}
              </div>
            )
          })}

          <div className="mx-1 mb-1 mt-3 h-px bg-white/[0.04]" />
          {BOTTOM_LINKS.map(({ to, label, icon }) => (
            <NavItem key={to} to={to} label={label} icon={icon} collapsed={collapsed} />
          ))}
        </nav>

        {/* ── User ── */}
        <div
          className={`shrink-0 border-t border-white/[0.05] ${
            collapsed ? 'px-1.5 pb-[14px] pt-[10px]' : 'px-2 pb-[14px] pt-[10px]'
          }`}
        >
          <div
            className={`rounded-[11px] border border-white/[0.06] ${
              collapsed ? 'px-0 py-[10px]' : 'p-[11px]'
            }`}
            style={{ background: 'rgba(255,255,255,0.025)' }}
          >
            <div
              className={`flex items-center ${
                collapsed ? 'flex-col justify-center gap-0' : 'flex-row justify-start gap-[10px]'
              }`}
            >
              {/* Avatar */}
              <div
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border border-primary/25 text-[12px] font-extrabold tracking-[0.02em] text-primary"
                style={{ background: 'linear-gradient(135deg, rgba(0,217,138,0.3) 0%, rgba(0,217,138,0.08) 100%)' }}
              >
                {initials}
              </div>

              {/* Info */}
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-semibold capitalize text-text-secondary">
                    {handle}
                  </div>
                  <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-[#2A5040]">
                    {role}
                  </div>
                </div>
              )}

              <LogoutBtn onClick={() => logout.mutate()} />
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto bg-bg-primary">
        <Outlet />
      </main>

      <StepUpDialog />
    </div>
  )
}

// ── Toggle button ─────────────────────────────────────────────────────────────
function ToggleBtn({ collapsed, onClick }: { collapsed: boolean; onClick(): void }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="flex h-[26px] w-[26px] shrink-0 cursor-pointer items-center justify-center rounded-[7px] border border-white/[0.07] bg-white/[0.04] text-[#4A7A6A] transition-all duration-[180ms] hover:border-primary/25 hover:bg-primary/10 hover:text-primary"
    >
      {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
    </button>
  )
}

// ── Logout button ─────────────────────────────────────────────────────────────
function LogoutBtn({ onClick }: { onClick(): void }) {
  return (
    <button
      onClick={onClick}
      title="Sign out"
      className="flex shrink-0 cursor-pointer items-center justify-center rounded-[7px] border border-transparent bg-transparent p-[5px] text-[#2A5040] transition-all duration-[180ms] hover:border-red-400/20 hover:bg-red-400/10 hover:text-red-400"
    >
      <LogOut size={13} />
    </button>
  )
}
