import { NavLink, Outlet } from 'react-router-dom';
import {
  BadgeCheck,
  Banknote,
  FileClock,
  Flag,
  Music2,
  Truck,
  MessageSquareWarning,
  Sparkles,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { useAuth } from '@/auth/store';
import { AdminRole } from '@/lib/enums';
import { cn } from '@/lib/cn';
import { StepUpDialog } from '@/auth/StepUpDialog';

/**
 * The shell: a sidebar of the sections this operator can actually use,
 * and the page.
 *
 * Entries are filtered by role rather than shown disabled. A console
 * for one product does not need to advertise the parts of itself a
 * reviewer will never open, and a sidebar of twenty greyed rows is how
 * the thing this replaced became unreadable.
 */
interface Section {
  to: string;
  label: string;
  icon: typeof ShieldCheck;
  /** Empty means every signed-in operator. */
  roles: number[];
}

const SECTIONS: Section[] = [
  { to: '/kyc', label: 'KYC review', icon: BadgeCheck, roles: [AdminRole.SuperAdmin, AdminRole.KycReviewer] },
  { to: '/moderation', label: 'Moderation', icon: Flag, roles: [AdminRole.SuperAdmin, AdminRole.ContentMod] },
  { to: '/post-reports', label: 'Post reports', icon: MessageSquareWarning, roles: [AdminRole.SuperAdmin, AdminRole.ContentMod] },
  { to: '/recipe-drafts', label: 'Recipe drafts', icon: Sparkles, roles: [AdminRole.SuperAdmin, AdminRole.ContentMod] },
  { to: '/audio', label: 'Audio', icon: Music2, roles: [AdminRole.SuperAdmin, AdminRole.ContentMod] },
  { to: '/couriers', label: 'Couriers', icon: Truck, roles: [AdminRole.SuperAdmin, AdminRole.SupportAgent] },
  { to: '/payouts', label: 'Payouts', icon: Banknote, roles: [AdminRole.SuperAdmin, AdminRole.PayoutsOps] },
  { to: '/admins', label: 'Admin accounts', icon: Users, roles: [AdminRole.SuperAdmin] },
  { to: '/flags', label: 'Feature flags', icon: SlidersHorizontal, roles: [AdminRole.SuperAdmin] },
  { to: '/audit', label: 'Audit log', icon: FileClock, roles: [] },
  { to: '/settings/mfa', label: 'My security', icon: ShieldCheck, roles: [] },
];

/** Role names on the token are strings; the enum is the wire integer. */
const ROLE_NAME: Record<number, string> = {
  [AdminRole.SuperAdmin]: 'SuperAdmin',
  [AdminRole.KycReviewer]: 'KycReviewer',
  [AdminRole.ContentMod]: 'ContentMod',
  [AdminRole.SupportAgent]: 'SupportAgent',
  [AdminRole.PayoutsOps]: 'PayoutsOps',
  [AdminRole.Readonly]: 'Readonly',
};

export function AppShell() {
  const claims = useAuth((s) => s.claims);
  const mine = new Set(claims?.roles ?? []);

  const visible = SECTIONS.filter(
    (s) => s.roles.length === 0 || s.roles.some((r) => mine.has(ROLE_NAME[r] ?? '')),
  );

  return (
    <div className="flex h-full min-w-[1280px]">
      <nav
        aria-label="Sections"
        className="flex w-60 shrink-0 flex-col gap-1 border-r border-surface-border bg-bg-secondary p-3"
      >
        <p className="px-3 pb-3 pt-2 text-sm font-black tracking-tight text-text-primary">
          Style Mint <span className="text-primary">Admin</span>
        </p>

        {visible.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light',
                isActive
                  ? 'bg-primary text-bg-primary'
                  : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </NavLink>
        ))}

        <div className="mt-auto border-t border-surface-border px-3 pt-3 text-xs text-text-muted">
          {claims?.email ?? claims?.name ?? 'Signed in'}
        </div>
      </nav>

      <main tabIndex={0} className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>

      {/* Once, here. The step-up store hands out a promise that only
          this component resolves, so a page that renders its own copy
          -- or a layout that renders none -- leaves the mutation that
          opened it pending for ever. */}
      <StepUpDialog />
    </div>
  );
}
