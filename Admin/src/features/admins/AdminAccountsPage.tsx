import { useState } from 'react';
import { useAdminAccounts, type AdminAccount } from '@/api/queries/useAdminAccounts';
import { DataTable, type Column } from '@/components/DataTable';
import { ListState } from '@/components/ListState';
import { PageHeader } from '@/components/PageHeader';
import { AdminAccountState } from '@/lib/enums';
import { AdminRoleLabel, labelOf } from '@/lib/formatters';
import { utcDate } from '@/lib/dates';
import type { AdminFilter } from '@/api/queryKeys';

const columns: Column<AdminAccount>[] = [
  {
    header: 'Operator',
    cell: (r) => (
      <span className="font-semibold text-text-primary">{r.displayName || r.email}</span>
    ),
  },
  { header: 'Email', cell: (r) => r.email },
  {
    header: 'Roles',
    cell: (r) =>
      r.roles.length ? r.roles.map((x) => labelOf(AdminRoleLabel, x)).join(', ') : 'No roles',
  },
  {
    header: 'State',
    cell: (r) =>
      r.state === AdminAccountState.Disabled ? (
        <span className="text-text-muted">Disabled</span>
      ) : (
        <span className="text-primary">Active</span>
      ),
  },
  { header: 'Last signed in', cell: (r) => utcDate(r.lastLoginUtc), align: 'right' },
];

/**
 * Who can get into this console, and as what.
 *
 * Read-only for now. Every write on this screen — granting a role,
 * disabling an account, revoking sessions, removing someone's MFA —
 * is on the step-up list, and each needs its own confirmation of what
 * it is about to do. Listing them first is useful on its own and does
 * not pretend the rest is finished.
 */
export function AdminAccountsPage() {
  const [filter] = useState<AdminFilter>({ page: 1, pageSize: 25 });
  const query = useAdminAccounts(filter);
  const items = query.data?.items ?? [];

  return (
    <section className="space-y-4">
      <PageHeader
        title="Admin accounts"
        query={query}
        total={query.data?.totalCount}
        noun="operators"
      />

      <div className="overflow-hidden rounded-xl border border-surface-border bg-bg-card">
        <ListState
          query={query}
          isEmpty={items.length === 0}
          noun="admin accounts"
          emptyTitle="No admin accounts."
        >
          <DataTable rows={items} columns={columns} rowKey={(r) => r.id} />
        </ListState>
      </div>

      <p className="text-xs text-text-muted">
        Role grants, disabling an account and revoking sessions all require step-up
        verification. Those actions are not wired up yet.
      </p>
    </section>
  );
}
