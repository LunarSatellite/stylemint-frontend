import { useState } from 'react';
import { useModerationQueue, type ModerationItem } from '@/api/queries/useModerationQueue';
import { useModerationDecide } from '@/api/mutations/useModerationDecide';
import { DataTable, type Column } from '@/components/DataTable';
import { ListState } from '@/components/ListState';
import { PageHeader } from '@/components/PageHeader';
import { ConfirmDialog, type ConfirmRequest } from '@/components/ConfirmDialog';
import { ModerationAction, ModerationItemState } from '@/lib/enums';
import {
  ModerationActionLabel,
  ModerationSourceLabel,
  ModerationStateLabel,
  ModerationTargetLabel,
  labelOf,
} from '@/lib/formatters';
import { utcDate } from '@/lib/dates';
import type { ModerationFilter } from '@/api/queryKeys';

/**
 * The moderation queue, and the decisions that close a case.
 *
 * The outcomes are ordered by how hard they are to undo, and the two
 * that act on a person rather than a post — suspend and ban — ask for
 * a note. Hiding a reel is reversible in a click; banning its author
 * is a decision somebody will have to explain later, and the note is
 * where the explanation lives.
 */
const OUTCOMES: { action: ModerationAction; label: string; danger?: boolean; note?: boolean }[] = [
  { action: ModerationAction.NoAction, label: 'No action' },
  { action: ModerationAction.HideContent, label: 'Hide' },
  { action: ModerationAction.RemoveContent, label: 'Remove', danger: true },
  { action: ModerationAction.WarnAuthor, label: 'Warn author' },
  { action: ModerationAction.SuspendAuthor, label: 'Suspend author', danger: true, note: true },
  { action: ModerationAction.BanAuthor, label: 'Ban author', danger: true, note: true },
];

export function ModerationQueuePage() {
  const [filter, setFilter] = useState<ModerationFilter>({ page: 1, pageSize: 25 });
  const query = useModerationQueue(filter);
  const decide = useModerationDecide(filter);
  const items = query.data?.items ?? [];

  const [pending, setPending] = useState<
    { request: ConfirmRequest; run: (note: string) => void } | null
  >(null);

  const columns: Column<ModerationItem>[] = [
    { header: 'Target', cell: (r) => labelOf(ModerationTargetLabel, r.targetKind) },
    { header: 'Reported via', cell: (r) => labelOf(ModerationSourceLabel, r.source) },
    { header: 'Reason', cell: (r) => r.reportReasonCode ?? '—' },
    { header: 'State', cell: (r) => labelOf(ModerationStateLabel, r.state) },
    {
      header: 'Outcome',
      cell: (r) => (r.action ? labelOf(ModerationActionLabel, r.action) : '—'),
    },
    { header: 'Submitted', cell: (r) => utcDate(r.submittedUtc) },
    {
      header: 'Decide',
      align: 'right',
      cell: (r) =>
        r.state === ModerationItemState.Decided ? (
          <span className="text-xs text-text-muted">Closed</span>
        ) : (
          <div className="flex flex-wrap justify-end gap-1.5">
            {OUTCOMES.map((o) => (
              <button
                key={o.action}
                type="button"
                onClick={() =>
                  setPending({
                    request: {
                      title: `${o.label} — ${labelOf(ModerationTargetLabel, r.targetKind)}`,
                      body: consequenceOf(o.action, labelOf(ModerationTargetLabel, r.targetKind)),
                      confirmLabel: o.label,
                      tone: o.danger ? 'danger' : 'normal',
                      requireReason: o.note === true,
                    },
                    run: (note) =>
                      decide.mutate({
                        moderationItemId: r.id,
                        action: o.action,
                        decisionNote: note || undefined,
                      }),
                  })
                }
                className={`rounded-md border px-2 py-1 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light ${
                  o.danger
                    ? 'border-red-500/30 text-red-300 hover:bg-red-500/10'
                    : 'border-surface-border text-text-secondary hover:bg-surface-2'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        ),
    },
  ];

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

      <ConfirmDialog
        request={pending?.request ?? null}
        onCancel={() => setPending(null)}
        onConfirm={(note) => {
          pending?.run(note);
          setPending(null);
        }}
      />
    </section>
  );
}

/** What the operator is actually about to do, in plain words. */
function consequenceOf(action: ModerationAction, target: string): string {
  switch (action) {
    case ModerationAction.NoAction:
      return `The report is closed and the ${target.toLowerCase()} stays exactly as it is.`;
    case ModerationAction.HideContent:
      return `The ${target.toLowerCase()} stops being shown to other people. The author keeps it and it can be unhidden.`;
    case ModerationAction.RemoveContent:
      return `The ${target.toLowerCase()} is taken down.`;
    case ModerationAction.WarnAuthor:
      return 'The author is told their content was reported and what the rule is. Nothing is taken down.';
    case ModerationAction.SuspendAuthor:
      return 'The author is suspended for seven days. They cannot post or sell during that time.';
    case ModerationAction.BanAuthor:
      return 'The author loses access to the platform. Say why — this note is the record.';
    default:
      return 'This closes the report.';
  }
}
