import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useKycQueue } from '@/api/queries/useKycQueue';
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
export function KycQueuePage() {
  const [filter, setFilter] = useState<KycQueueFilter>({ status: undefined, page: 1, pageSize: 25 });
  const query = useKycQueue(filter);
  const items = query.data?.items ?? [];

  return (
    <section className="space-y-4">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-text-primary">KYC review</h1>
          <p className="mt-1 text-xs text-text-muted">
            {query.isError
              ? 'Count unavailable'
              : query.isPending
                ? 'Loading…'
                : `${query.data?.totalCount.toLocaleString() ?? 0} in queue`}
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
            State
          </span>
          <select
            value={filter.status ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value || undefined, page: 1 }))}
            className="rounded-lg border border-surface-border bg-bg-elevated px-3 py-2 text-sm font-normal tracking-normal text-text-primary"
          >
            <option value="">All states</option>
            <option value={KycState.Pending}>Pending</option>
            <option value={KycState.Approved}>Approved</option>
            <option value={KycState.Rejected}>Rejected</option>
          </select>
        </label>
      </header>

      <div className="overflow-hidden rounded-xl border border-surface-border bg-bg-card">
        {query.isError ? (
          <p className="px-6 py-12 text-center text-sm text-text-secondary">
            Could not load the review queue. It is not empty — the request failed.
          </p>
        ) : query.isPending ? (
          <p className="px-6 py-12 text-center text-sm text-text-muted">Loading the queue…</p>
        ) : items.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-text-muted">
            Nothing waiting for review.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {['Applicant', 'State', 'Submitted', 'Due', 'Reviewer'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-muted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-surface-border last:border-0">
                  <td className="px-4 py-3 font-semibold text-text-primary">
                    {labelOf(KycApplicantKindLabel, item.applicantKind)}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {labelOf(KycStateLabel, item.state)}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{isoDate(item.submittedUtc)}</td>
                  <td className="px-4 py-3 text-text-secondary">{isoDate(item.dueByUtc)}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {item.assignedReviewerId ? 'Assigned' : 'Unassigned'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

/** A malformed date from the API must not blank the whole row. */
function isoDate(value: string | null): string {
  if (!value) return '—';
  try {
    return format(parseISO(value), 'd MMM yyyy, HH:mm');
  } catch {
    return value;
  }
}
