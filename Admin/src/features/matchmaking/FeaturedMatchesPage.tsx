import { useState } from 'react';
import {
  useFairnessAudit,
  useFeaturedPending,
  type FeaturedMatch,
} from '@/api/queries/useFeaturedMatches';
import {
  useApproveFeatured,
  useRejectFeatured,
  useRunFairnessAudit,
} from '@/api/mutations/useFeaturedActions';
import { DataTable, type Column } from '@/components/DataTable';
import { ListState } from '@/components/ListState';
import { PageHeader } from '@/components/PageHeader';
import { ConfirmDialog, type ConfirmRequest } from '@/components/ConfirmDialog';
import { FeaturedMatchStateLabel, labelOf } from '@/lib/formatters';
import { utcDate } from '@/lib/dates';

/**
 * Matches the algorithm proposes to feature, and the fairness audit
 * of the algorithm proposing them.
 *
 * The audit is above the queue deliberately. An operator approving
 * featured matches one by one should know whether the thing choosing
 * them currently passes its own fairness check — that is context for
 * every decision below it, not a separate report to go and find.
 */
export function FeaturedMatchesPage() {
  const pending = useFeaturedPending();
  const fairness = useFairnessAudit();
  const approve = useApproveFeatured();
  const reject = useRejectFeatured();
  const runAudit = useRunFairnessAudit();

  const rows = pending.data?.items ?? [];
  const [confirm, setConfirm] = useState<
    { request: ConfirmRequest; run: (note: string) => void } | null
  >(null);

  const columns: Column<FeaturedMatch>[] = [
    {
      header: 'Proposed',
      cell: (m) => <span className="text-text-secondary">{utcDate(m.proposedUtc)}</span>,
    },
    { header: 'State', cell: (m) => labelOf(FeaturedMatchStateLabel, m.state) },
    { header: 'Reviewer note', cell: (m) => m.reviewerNote ?? '—' },
    { header: 'Reviewed', cell: (m) => utcDate(m.reviewedUtc) },
    {
      header: 'Decide',
      align: 'right',
      cell: (m) => (
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={() =>
              setConfirm({
                request: {
                  title: 'Approve this featured match?',
                  body: 'It becomes eligible to be pushed to users. Approving is not the same as pushing — that happens separately.',
                  confirmLabel: 'Approve',
                  requireReason: true,
                },
                run: (note) => approve.mutate({ id: m.id, note }),
              })
            }
            className="rounded-md border border-surface-border px-2 py-1 text-[11px] font-bold text-text-secondary hover:bg-surface-2"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() =>
              setConfirm({
                request: {
                  title: 'Reject this featured match?',
                  body: 'It will not be shown to users. Say why — the note is what the next reviewer reads.',
                  confirmLabel: 'Reject',
                  tone: 'danger',
                  requireReason: true,
                },
                run: (note) => reject.mutate({ id: m.id, note }),
              })
            }
            className="rounded-md border border-red-500/30 px-2 py-1 text-[11px] font-bold text-red-300 hover:bg-red-500/10"
          >
            Reject
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <PageHeader
        title="Featured matches"
        query={pending}
        total={pending.data?.totalCount}
        noun="awaiting review"
      />

      <div className="rounded-xl border border-surface-border bg-bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-text-primary">Fairness audit</h2>
            {fairness.isError ? (
              <p className="mt-1 text-xs text-text-secondary">
                Could not read the latest audit. That is not the same as the algorithm failing
                one — the report could not be fetched.
              </p>
            ) : fairness.isPending ? (
              <p className="mt-1 text-xs text-text-muted">Checking…</p>
            ) : fairness.data ? (
              <p className="mt-1 text-xs text-text-secondary">
                <span className={fairness.data.passed ? 'text-primary' : 'text-red-300'}>
                  {fairness.data.passed ? 'Passed' : 'Did not pass'}
                </span>{' '}
                · ran {utcDate(fairness.data.ranUtc)}
                {fairness.data.maxDisparityIndex !== null &&
                  ` · peak disparity ${fairness.data.maxDisparityIndex}`}
                {fairness.data.scorerVersion && ` · scorer ${fairness.data.scorerVersion}`}
              </p>
            ) : (
              <p className="mt-1 text-xs text-text-muted">No audit has been run yet.</p>
            )}
          </div>

          <button
            type="button"
            disabled={runAudit.isPending}
            onClick={() => runAudit.mutate()}
            className="shrink-0 rounded-lg border border-surface-border px-3 py-1.5 text-xs font-bold text-text-secondary hover:bg-surface-2 disabled:opacity-40"
          >
            {runAudit.isPending ? 'Starting…' : 'Run audit now'}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border bg-bg-card">
        <ListState
          query={pending}
          isEmpty={rows.length === 0}
          noun="featured matches"
          emptyTitle="Nothing proposed for review."
        >
          <DataTable rows={rows} columns={columns} rowKey={(m) => m.id} />
        </ListState>
      </div>

      {pending.data?.hasMore && (
        <p className="text-xs text-text-muted">
          More proposals exist beyond this page. This endpoint pages by cursor; paging is not
          wired up yet.
        </p>
      )}

      <ConfirmDialog
        request={confirm?.request ?? null}
        onCancel={() => setConfirm(null)}
        onConfirm={(note) => {
          confirm?.run(note);
          setConfirm(null);
        }}
      />
    </section>
  );
}
