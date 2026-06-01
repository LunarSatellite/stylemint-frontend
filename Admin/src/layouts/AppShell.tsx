import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { StepUpDialog } from '@/auth/StepUpDialog'
import { useLogout } from '@/api/mutations/useLogout'
import { useAuth } from '@/auth/store'
import { permissions } from '@/lib/permissions'
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
  const [hovered, setHovered] = useState(false)

  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ textDecoration:'none', display:'block', marginBottom:1 }}
    >
      {({ isActive }) => (
        <div style={{
          position:       'relative',
          display:        'flex',
          alignItems:     'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap:            10,
          padding:        collapsed ? '8px 0' : '8px 10px 8px 14px',
          borderRadius:   9,
          background:     isActive
            ? 'linear-gradient(90deg, rgba(0,217,138,0.13) 0%, rgba(0,217,138,0.03) 70%, transparent 100%)'
            : hovered ? 'rgba(255,255,255,0.035)' : 'transparent',
          transition:     'background 0.18s',
          cursor:         'pointer',
        }}>

          {/* Left glow accent — only when expanded */}
          {!collapsed && (
            <div style={{
              position:     'absolute',
              left:         0,
              top:          5,
              bottom:       5,
              width:        3,
              borderRadius: '0 3px 3px 0',
              background:   isActive ? '#00D98A' : 'transparent',
              boxShadow:    isActive ? '0 0 10px rgba(0,217,138,0.7)' : 'none',
              transition:   'all 0.18s',
            }} />
          )}

          {/* Icon box */}
          <div style={{
            width:          28,
            height:         28,
            borderRadius:   7,
            background:     isActive
              ? 'rgba(0,217,138,0.15)'
              : hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexShrink:     0,
            transition:     'background 0.18s',
          }}>
            <Icon size={14} style={{ color: isActive ? '#00D98A' : hovered ? '#B8E6D5' : '#4A7A6A', transition:'color 0.18s' }} />
          </div>

          {/* Label + active dot — only when expanded */}
          {!collapsed && (
            <>
              <span style={{
                fontSize:   13,
                fontWeight: isActive ? 600 : 400,
                color:      isActive ? '#00D98A' : hovered ? '#B8E6D5' : '#7A9B8E',
                transition: 'color 0.18s',
                flex:       1,
                whiteSpace: 'nowrap',
                overflow:   'hidden',
              }}>
                {label}
              </span>
              {isActive && (
                <div style={{ width:5, height:5, borderRadius:'50%', background:'#00D98A', boxShadow:'0 0 6px rgba(0,217,138,0.8)', flexShrink:0 }} />
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
    return <div style={{ height:1, background:'rgba(255,255,255,0.05)', margin:'10px 8px 6px' }} />
  }
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'16px 12px 6px', marginBottom:2 }}>
      <div style={{ width:4, height:4, borderRadius:'50%', background:'#1E4A38', flexShrink:0 }} />
      <span style={{ fontSize:10, fontWeight:700, color:'#2A5040', textTransform:'uppercase', letterSpacing:'0.12em' }}>
        {label}
      </span>
      <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.04)' }} />
    </div>
  )
}

// ── AppShell ──────────────────────────────────────────────────────────────────
export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)

  const claims  = useAuth((s) => s.claims)
  const roles: string[] = claims?.roles ?? []
  const logout  = useLogout()
  const email   = claims?.email ?? ''
  const handle  = email.split('@')[0]
  const initials = handle.slice(0, 2).toUpperCase()
  const role    = roles[0] ?? 'Admin'

  return (
    <div style={{ display:'flex', height:'100vh', background:'#0A1612' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width:         collapsed ? 68 : 240,
        flexShrink:    0,
        display:       'flex',
        flexDirection: 'column',
        background:    'linear-gradient(180deg, #0C1A14 0%, #0A1612 100%)',
        borderRight:   '1px solid rgba(255,255,255,0.05)',
        overflow:      'hidden',
        transition:    'width 0.22s ease',
      }}>

        {/* ── Logo + Toggle — fixed top ── */}
        <div style={{ flexShrink:0, borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
          {/* Logo row */}
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding:        collapsed ? '18px 0 10px' : '20px 12px 10px 16px',
            gap:            10,
          }}>
            {/* S icon */}
            <div style={{
              width:          38,
              height:         38,
              borderRadius:   10,
              background:     '#0D2319',
              border:         '1px solid rgba(0,217,138,0.2)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
              boxShadow:      '0 0 16px rgba(0,217,138,0.1)',
            }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M4 11 C4 7 6 3.5 11 3.5 C16 3.5 18 7 18 9.5 C18 12 16 13 11 13"
                      stroke="#00D98A" strokeWidth="1.7" strokeLinecap="round" fill="none"/>
                <path d="M18 12.5 C18 16.5 16 18.5 11 18.5 C6 18.5 4 15 4 12.5 C4 10 6 9 11 9"
                      stroke="#00D98A" strokeWidth="1.7" strokeLinecap="round" fill="none"/>
                <circle cx="11" cy="11" r="1.3" fill="#00D98A"/>
              </svg>
            </div>

            {/* Name + badge — hidden when collapsed */}
            {!collapsed && (
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:16, fontWeight:800, color:'#ffffff', letterSpacing:'-0.3px', lineHeight:1.2, whiteSpace:'nowrap' }}>
                  StyleMint
                </div>
                <div style={{
                  display:'inline-flex', alignItems:'center', marginTop:4,
                  background:'rgba(0,217,138,0.1)', border:'1px solid rgba(0,217,138,0.2)',
                  borderRadius:99, padding:'1px 8px',
                  fontSize:9, fontWeight:700, color:'#00D98A', letterSpacing:'0.1em', textTransform:'uppercase',
                }}>
                  Admin Portal
                </div>
              </div>
            )}

            {/* Toggle button — always visible */}
            <ToggleBtn collapsed={collapsed} onClick={() => setCollapsed(c => !c)} />
          </div>
        </div>

        {/* ── Nav — scrollable middle ── */}
        <nav className="sm-nav-scroll" style={{ flex:1, padding: collapsed ? '4px 6px 0' : '4px 8px 0', overflowY:'auto' }}>
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

          <div style={{ margin:'12px 4px 4px', height:1, background:'rgba(255,255,255,0.04)' }} />
          {BOTTOM_LINKS.map(({ to, label, icon }) => (
            <NavItem key={to} to={to} label={label} icon={icon} collapsed={collapsed} />
          ))}
        </nav>

        {/* ── User — fixed bottom ── */}
        <div style={{ flexShrink:0, borderTop:'1px solid rgba(255,255,255,0.05)', padding: collapsed ? '10px 6px 14px' : '10px 8px 14px' }}>
          <div style={{
            background:   'rgba(255,255,255,0.025)',
            border:       '1px solid rgba(255,255,255,0.06)',
            borderRadius: 11,
            padding:      collapsed ? '10px 0' : '11px',
          }}>
            <div style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap:            collapsed ? 0 : 10,
              flexDirection:  collapsed ? 'column' : 'row',
            }}>

              {/* Avatar */}
              <div style={{
                width:          34,
                height:         34,
                borderRadius:   9,
                background:     'linear-gradient(135deg, rgba(0,217,138,0.3) 0%, rgba(0,217,138,0.08) 100%)',
                border:         '1px solid rgba(0,217,138,0.25)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       12,
                fontWeight:     800,
                color:          '#00D98A',
                flexShrink:     0,
                letterSpacing:  '0.02em',
              }}>
                {initials}
              </div>

              {/* Info — hidden when collapsed */}
              {!collapsed && (
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#B8E6D5', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', textTransform:'capitalize' }}>
                    {handle}
                  </div>
                  <div style={{ fontSize:10, color:'#2A5040', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {role}
                  </div>
                </div>
              )}

              {/* Logout */}
              <LogoutBtn onClick={() => logout.mutate()} />
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex:1, overflowY:'auto', background:'#0A1612' }}>
        <Outlet />
      </main>

      <StepUpDialog />
    </div>
  )
}

// ── Toggle button ─────────────────────────────────────────────────────────────
function ToggleBtn({ collapsed, onClick }: { collapsed: boolean; onClick(): void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width:          26,
        height:         26,
        borderRadius:   7,
        background:     hovered ? 'rgba(0,217,138,0.1)' : 'rgba(255,255,255,0.04)',
        border:         '1px solid ' + (hovered ? 'rgba(0,217,138,0.25)' : 'rgba(255,255,255,0.07)'),
        cursor:         'pointer',
        color:          hovered ? '#00D98A' : '#4A7A6A',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
        transition:     'all 0.18s',
      }}
    >
      {collapsed ? <ChevronRight size={13}/> : <ChevronLeft size={13}/>}
    </button>
  )
}

// ── Logout button ─────────────────────────────────────────────────────────────
function LogoutBtn({ onClick }: { onClick(): void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      title="Sign out"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:     hovered ? 'rgba(248,113,113,0.1)' : 'transparent',
        border:         '1px solid ' + (hovered ? 'rgba(248,113,113,0.2)' : 'transparent'),
        borderRadius:   7,
        cursor:         'pointer',
        color:          hovered ? '#f87171' : '#2A5040',
        padding:        5,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
        transition:     'all 0.18s',
      }}
    >
      <LogOut size={13}/>
    </button>
  )
}
