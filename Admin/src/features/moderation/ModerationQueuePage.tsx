import { useState } from 'react';
import { useModerationQueue, type ModerationItem } from '@/api/queries/useModerationQueue';
import { DataTable, type Column } from '@/components/DataTable';
import { ListState } from '@/components/ListState';
import { PageHeader } from '@/components/PageHeader';
import { ModerationItemState } from '@/lib/enums';
import {
  ModerationActionLabel,
  ModerationSourceLabel,
  ModerationStateLabel,
  ModerationTargetLabel,
  labelOf,
} from '@/lib/formatters';
import { utcDate } from '@/lib/dates';
import type { ModerationFilter } from '@/api/queryKeys';

const columns: Column<ModerationItem>[] = [
  { header: 'Target', cell: (r) => labelOf(ModerationTargetLabel, r.targetKind) },
  { header: 'Reported via', cell: (r) => labelOf(ModerationSourceLabel, r.source) },
  { header: 'Reason', cell: (r) => r.reportReasonCode ?? '—' },
  { header: 'State', cell: (r) => labelOf(ModerationStateLabel, r.state) },
  { header: 'Outcome', cell: (r) => (r.action ? labelOf(ModerationActionLabel, r.action) : '—') },
  { header: 'Submitted', cell: (r) => utcDate(r.submittedUtc), align: 'right' },
];

export function ModerationQueuePage() {
  const [filter, setFilter] = useState<ModerationFilter>({ page: 1, pageSize: 25 });
  const query = useModerationQueue(filter);
  const items = query.data?.items ?? [];

  return (
    <section className="space-y-4">
      <PageHeader
        title="Moderation"
        query={query}
        total={query.data?.totalCount}
        actions={
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              State
            </span>
            <select
              value={filter.status ?? ''}
              onChange={(e) =>
                setFilter((f) => ({ ...f, status: e.target.value || undefined, page: 1 }))
              }
              className="rounded-lg border border-surface-border bg-bg-elevated px-3 py-2 text-sm font-normal tracking-normal text-text-primary"
            >
              <option value="">All states</option>
              <option value={ModerationItemState.Open}>Open</option>
              <option value={ModerationItemState.InReview}>In review</option>
              <option value={ModerationItemState.Decided}>Decided</option>
            </select>
          </label>
        }
      />

      <div className="overflow-hidden rounded-xl border border-surface-border bg-bg-card">
        <ListState
          query={query}
          isEmpty={items.length === 0}
          noun="moderation reports"
          emptyTitle="Nothing waiting for moderation."
        >
          <DataTable rows={items} columns={columns} rowKey={(r) => r.id} />
        </ListState>
      </div>
    </section>
  );
}
