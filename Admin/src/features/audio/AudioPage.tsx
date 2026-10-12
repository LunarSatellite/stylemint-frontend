import { useState } from 'react';
import {
  useAudioTracks,
  useBrokenAudioLinks,
  type MusicTrack,
} from '@/api/queries/useAudioTracks';
import { useHideTrack, useRestoreTrack } from '@/api/mutations/useAudioTrackActions';
import { DataTable, type Column } from '@/components/DataTable';
import { ListState } from '@/components/ListState';
import { PageHeader } from '@/components/PageHeader';
import { ConfirmDialog, type ConfirmRequest } from '@/components/ConfirmDialog';
import { MusicTrackState } from '@/lib/enums';
import { MusicTrackStateLabel, labelOf } from '@/lib/formatters';

type Tab = 'broken' | 'all';

/**
 * Music used in reels.
 *
 * Two tabs, and the broken-links queue is first on purpose. It is the
 * only one that is work: a track lands there when the daily health
 * check finds every source link dead, which means it has already
 * stopped appearing in the app. "All tracks" is a lookup.
 *
 * Hidden and LinksBroken both keep a track off the surfaces, and the
 * table shows which is which, because only one of them is anybody's
 * mistake to fix.
 */
export function AudioPage() {
  const [tab, setTab] = useState<Tab>('broken');
  const [stateFilter, setStateFilter] = useState<string | undefined>();

  const broken = useBrokenAudioLinks();
  const all = useAudioTracks({ state: stateFilter });
  const query = tab === 'broken' ? broken : all;
  const rows = query.data?.items ?? [];

  const hide = useHideTrack();
  const restore = useRestoreTrack();
  const [pending, setPending] = useState<
    { request: ConfirmRequest; run: (reason: string) => void } | null
  >(null);

  const columns: Column<MusicTrack>[] = [
    {
      header: 'Track',
      cell: (t) => (
        <span className="font-semibold text-text-primary">
          {t.title}
          {t.artist && <span className="ml-2 font-normal text-text-muted">{t.artist}</span>}
        </span>
      ),
    },
    { header: 'State', cell: (t) => labelOf(MusicTrackStateLabel, t.state) },
    {
      header: 'Why hidden',
      cell: (t) =>
        t.state === MusicTrackState.LinksBroken
          ? 'Every source link is dead'
          : (t.hiddenReason ?? '—'),
    },
    {
      header: 'Used in reels',
      cell: (t) => t.citedInReelCount.toLocaleString(),
      align: 'right',
    },
    {
      header: '',
      align: 'right',
      cell: (t) =>
        t.state === MusicTrackState.Hidden ? (
          <button
            type="button"
            onClick={() =>
              setPending({
                request: {
                  title: `Put "${t.title}" back?`,
                  body: 'The track starts appearing in recommendations again straight away.',
                  confirmLabel: 'Restore track',
                },
                run: () => restore.mutate({ trackId: t.id, title: t.title }),
              })
            }
            className="rounded-lg border border-surface-border px-2.5 py-1.5 text-xs font-bold text-text-secondary hover:bg-surface-2"
          >
            Restore
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              setPending({
                request: {
                  title: `Hide "${t.title}"?`,
                  body: `The track stops appearing in recommendations. ${t.citedInReelCount.toLocaleString()} existing reels already use it and are not affected.`,
                  confirmLabel: 'Hide track',
                  tone: 'danger',
                  requireReason: true,
                },
                run: (reason) => hide.mutate({ trackId: t.id, title: t.title, reason }),
              })
            }
            className="rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/10"
          >
            Hide
          </button>
        ),
    },
  ];

  return (
    <section className="space-y-4">
      <PageHeader
        title="Audio"
        query={query}
        total={query.data?.totalCount}
        noun={tab === 'broken' ? 'needing attention' : 'tracks'}
        actions={
          tab === 'all' && (
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                State
              </span>
              <select
                value={stateFilter ?? ''}
                onChange={(e) => setStateFilter(e.target.value || undefined)}
                className="rounded-lg border border-surface-border bg-bg-elevated px-3 py-2 text-sm font-normal tracking-normal text-text-primary"
              >
                <option value="">All states</option>
                <option value={MusicTrackState.Active}>Active</option>
                <option value={MusicTrackState.Hidden}>Hidden</option>
                <option value={MusicTrackState.LinksBroken}>Links broken</option>
              </select>
            </label>
          )
        }
      />

      <div role="group" aria-label="Which tracks to show" className="flex gap-2">
        <Tab id="broken" active={tab} onSelect={setTab} label="Needs attention" />
        <Tab id="all" active={tab} onSelect={setTab} label="All tracks" />
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border bg-bg-card">
        <ListState
          query={query}
          isEmpty={rows.length === 0}
          noun={tab === 'broken' ? 'broken tracks' : 'audio tracks'}
          emptyTitle={
            tab === 'broken' ? 'Every track’s links are working.' : 'No tracks match this filter.'
          }
        >
          <DataTable rows={rows} columns={columns} rowKey={(t) => t.id} />
        </ListState>
      </div>

      {query.data?.hasMore && (
        <p className="text-xs text-text-muted">
          More tracks exist beyond this page. Paging through them is not wired up yet — this
          endpoint uses a cursor rather than page numbers.
        </p>
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

function Tab({
  id,
  active,
  onSelect,
  label,
}: {
  id: Tab;
  active: Tab;
  onSelect: (t: Tab) => void;
  label: string;
}) {
  const selected = active === id;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(id)}
      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
        selected
          ? 'bg-primary text-bg-primary'
          : 'border border-surface-border text-text-secondary hover:bg-surface-2'
      }`}
    >
      {label}
    </button>
  );
}
