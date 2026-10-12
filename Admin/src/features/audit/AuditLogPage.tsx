import { useState } from 'react';
import { useAuditLog, type AuditEntry } from '@/api/queries/useAuditLog';
import { DataTable, type Column } from '@/components/DataTable';
import { ListState } from '@/components/ListState';
import { PageHeader } from '@/components/PageHeader';
import { utcDate } from '@/lib/dates';
import type { AuditFilter } from '@/api/queryKeys';

const columns: Column<AuditEntry>[] = [
  { header: 'When', cell: (r) => utcDate(r.occurredUtc) },
  {
    header: 'Action',
    cell: (r) => <span className="font-semibold text-text-primary">{r.action}</span>,
  },
  { header: 'Target', cell: (r) => [r.targetKind, r.targetId].filter(Boolean).join(' · ') || '—' },
  { header: 'Reason', cell: (r) => r.reason ?? '—' },
  { header: 'From', cell: (r) => r.sourceIp ?? '—', align: 'right' },
];

/**
 * What operators did.
 *
 * Append-only and the one screen whose value is entirely in being
 * trustworthy, which is why a failed request here must never render as
 * an empty log: "no admin actions recorded" is a strong claim, and the
 * one an investigator would act on.
 */
export function AuditLogPage() {
  const [filter, setFilter] = useState<AuditFilter>({ page: 1, pageSize: 50 });
  const query = useAuditLog(filter);
  const items = query.data?.items ?? [];

  return (
    <section className="space-y-4">
      <PageHeader
        title="Audit log"
        query={query}
        total={query.data?.totalCount}
        noun="entries"
        actions={
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Action
            </span>
            <input
              value={filter.action ?? ''}
              onChange={(e) =>
                setFilter((f) => ({ ...f, action: e.target.value || undefined, page: 1 }))
              }
              placeholder="e.g. kyc.decide"
              className="rounded-lg border border-surface-border bg-bg-elevated px-3 py-2 text-sm font-normal tracking-normal text-text-primary placeholder:text-text-muted"
            />
          </label>
        }
      />

      <div className="overflow-hidden rounded-xl border border-surface-border bg-bg-card">
        <ListState
          query={query}
          isEmpty={items.length === 0}
          noun="audit entries"
          emptyTitle="No entries match this filter."
        >
          <DataTable rows={items} columns={columns} rowKey={(r) => r.id} />
        </ListState>
      </div>
    </section>
  );
}
