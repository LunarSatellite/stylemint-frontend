import { useState } from 'react';
import { usePostReports, type PostReport } from '@/api/queries/usePostReports';
import {
  useHidePost,
  useRemovePost,
  useResolveReport,
  useRestorePost,
} from '@/api/mutations/useSocialFeedActions';
import { DataTable, type Column } from '@/components/DataTable';
import { ListState } from '@/components/ListState';
import { PageHeader } from '@/components/PageHeader';
import { ConfirmDialog, type ConfirmRequest } from '@/components/ConfirmDialog';
import { PostReportState } from '@/lib/enums';
import { PostReportReasonLabel, PostReportStateLabel, labelOf } from '@/lib/formatters';
import { utcDate } from '@/lib/dates';

const CLOSED = new Set<number>([
  PostReportState.Actioned,
  PostReportState.Dismissed,
  PostReportState.Duplicate,
]);

/**
 * Reports on social-feed posts.
 *
 * Acting on the post and closing the report are two calls in the API,
 * and they stay two actions here. A moderator can dismiss a report
 * without touching the post, or take the post down and still owe an
 * answer on the report. One button doing both would decide that for
 * them and record a resolution they did not choose.
 *
 * The reports this endpoint returns are not filtered by state, so the
 * closed ones are shown with their outcome rather than hidden — a
 * moderator checking whether something was already handled needs to
 * see that it was.
 */
export function PostReportsPage() {
  const [take, setTake] = useState(50);
  const query = usePostReports(take);
  const reports = query.data ?? [];

  const resolve = useResolveReport();
  const hide = useHidePost();
  const remove = useRemovePost();
  const restore = useRestorePost();

  const [pending, setPending] = useState<
    { request: ConfirmRequest; run: (reason: string) => void } | null
  >(null);

  const columns: Column<PostReport>[] = [
    {
      header: 'Reported for',
      cell: (r) => (
        <span className="font-semibold text-text-primary">
          {labelOf(PostReportReasonLabel, r.reason)}
        </span>
      ),
    },
    { header: 'Context', cell: (r) => r.context || '—' },
    { header: 'State', cell: (r) => labelOf(PostReportStateLabel, r.state) },
    {
      header: 'Outcome',
      cell: (r) => (r.resolvedUtc ? (r.resolutionNote ?? 'Closed') : '—'),
    },
    { header: 'Reported', cell: (r) => utcDate(r.createdUtc) },
    {
      header: 'Actions',
      align: 'right',
      cell: (r) =>
        CLOSED.has(r.state) ? (
          <div className="flex justify-end gap-1.5">
            <Act
              label="Restore post"
              onClick={() =>
                setPending({
                  request: {
                    title: 'Put this post back?',
                    body: 'It becomes visible in the feed again. The report stays closed.',
                    confirmLabel: 'Restore post',
                  },
                  run: () => restore.mutate({ postId: r.postId }),
                })
              }
            />
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-1.5">
            <Act
              label="Hide post"
              onClick={() =>
                setPending({
                  request: {
                    title: 'Hide this post?',
                    body: 'It stops showing in the feed. The author keeps it and it can be restored. This does not close the report.',
                    confirmLabel: 'Hide post',
                    requireReason: true,
                  },
                  run: (reason) => hide.mutate({ postId: r.postId, reason }),
                })
              }
            />
            <Act
              label="Remove post"
              danger
              onClick={() =>
                setPending({
                  request: {
                    title: 'Remove this post?',
                    body: 'It is taken down. This does not close the report — do that separately once you have decided the outcome.',
                    confirmLabel: 'Remove post',
                    tone: 'danger',
                    requireReason: true,
                  },
                  run: (reason) => remove.mutate({ postId: r.postId, reason }),
                })
              }
            />
            <Act
              label="Close report"
              onClick={() =>
                setPending({
                  request: {
                    title: 'Close this report?',
                    body: 'The report is marked resolved. Whatever you did or did not do to the post stays as it is — say which here.',
                    confirmLabel: 'Close report',
                    requireReason: true,
                  },
                  run: (reason) => resolve.mutate({ reportId: r.id, reason }),
                })
              }
            />
          </div>
        ),
    },
  ];

  return (
    <section className="space-y-4">
      <PageHeader
        title="Post reports"
        query={query}
        total={reports.length}
        noun={`shown${query.data && reports.length === take ? ' (there may be more)' : ''}`}
      />

      <div className="overflow-hidden rounded-xl border border-surface-border bg-bg-card">
        <ListState
          query={query}
          isEmpty={reports.length === 0}
          noun="post reports"
          emptyTitle="No posts have been reported."
        >
          <DataTable rows={reports} columns={columns} rowKey={(r) => r.id} />
        </ListState>
      </div>

      {reports.length === take && (
        <button
          type="button"
          onClick={() => setTake((t) => t + 50)}
          className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-bold text-text-secondary hover:bg-surface-2"
        >
          Show more
        </button>
      )}

      <ConfirmDialog
        request={pending?.request ?? null}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => {
          pending?.run(reason);
          setPending(null);
        }}
      />
    </section>
  );
}

function Act({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light ${
        danger
          ? 'border-red-500/30 text-red-300 hover:bg-red-500/10'
          : 'border-surface-border text-text-secondary hover:bg-surface-2'
      }`}
    >
      {label}
    </button>
  );
}
