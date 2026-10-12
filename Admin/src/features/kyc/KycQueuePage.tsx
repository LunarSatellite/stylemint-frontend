import { useState } from 'react';
import { useKycQueue, type KycReviewItem } from '@/api/queries/useKycQueue';
import { DataTable, type Column } from '@/components/DataTable';
import { ListState } from '@/components/ListState';
import { PageHeader } from '@/components/PageHeader';
import { utcDate } from '@/lib/dates';
import { KycApplicantKindLabel, KycStateLabel, labelOf } from '@/lib/formatters';
import { KycState } from '@/lib/enums';
import type { KycQueueFilter } from '@/api/queryKeys';

/**
 * The KYC queue — the first screen an operator opens.
 *
 * This is the container: it owns the query and the filter, and renders
 * the four states a list can be in. A failed request shows as a
 * failure, never as "no applications": the whole point of a review
 * queue is that an empty one means there is nothing to do today, and
 * that has to be true when it says it.
 */
const columns: Column<KycReviewItem>[] = [
  {
    header: 'Applicant',
    cell: (r) => (
      <span className="font-semibold text-text-primary">
        {labelOf(KycApplicantKindLabel, r.applicantKind)}
      </span>
    ),
  },
  { header: 'State', cell: (r) => labelOf(KycStateLabel, r.state) },
  { header: 'Reviewer', cell: (r) => (r.assignedReviewerId ? 'Assigned' : 'Unassigned') },
  { header: 'Submitted', cell: (r) => utcDate(r.submittedUtc), align: 'right' },
  { header: 'Due', cell: (r) => utcDate(r.dueByUtc), align: 'right' },
];

export function KycQueuePage() {
  const [filter, setFilter] = useState<KycQueueFilter>({ status: undefined, page: 1, pageSize: 25 });
  const query = useKycQueue(filter);
  const items = query.data?.items ?? [];

  return (
    <section className="space-y-4">
      <PageHeader
        title="KYC review"
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
              <option value={KycState.Pending}>Pending</option>
              <option value={KycState.Approved}>Approved</option>
              <option value={KycState.Rejected}>Rejected</option>
            </select>
          </label>
        }
      />

      <div className="overflow-hidden rounded-xl border border-surface-border bg-bg-card">
        <ListState
          query={query}
          isEmpty={items.length === 0}
          noun="KYC applications"
          emptyTitle="Nothing waiting for review."
        >
          <DataTable rows={items} columns={columns} rowKey={(r) => r.id} />
        </ListState>
      </div>
    </section>
  );
}

