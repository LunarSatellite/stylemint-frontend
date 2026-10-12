import { useState } from 'react';
import { usePopularSearches, type PopularSearch } from '@/api/queries/usePopularSearches';
import {
  useActivateSearch,
  useDeactivateSearch,
} from '@/api/mutations/usePopularSearchActions';
import { DataTable, type Column } from '@/components/DataTable';
import { ListState } from '@/components/ListState';
import { PageHeader } from '@/components/PageHeader';

/**
 * The suggested searches shown to shoppers.
 *
 * `label` is what a shopper reads; `query` is what actually runs.
 * They are separate fields in the API and both are shown, because a
 * suggestion whose label and query have drifted apart sends people
 * somewhere they did not ask to go — and nothing else in the product
 * would surface that.
 *
 * Toggling is immediate and reversible, so it is a switch rather than
 * a confirmation: asking "are you sure?" for something undone by
 * clicking the same control again trains people to dismiss dialogs.
 */
export function PopularSearchesPage() {
  const [region, setRegion] = useState('');
  const query = usePopularSearches(region || undefined);
  const searches = query.data ?? [];

  const activate = useActivateSearch();
  const deactivate = useDeactivateSearch();
  const busy = activate.isPending || deactivate.isPending;

  const columns: Column<PopularSearch>[] = [
    {
      header: 'Shown as',
      cell: (s) => <span className="font-semibold text-text-primary">{s.label}</span>,
    },
    {
      header: 'Actually searches',
      cell: (s) => (
        <code className={s.label === s.query ? 'text-text-muted' : 'text-text-secondary'}>
          {s.query}
        </code>
      ),
    },
    { header: 'Region', cell: (s) => s.regionCode || 'All regions' },
    { header: 'Order', cell: (s) => String(s.displayOrder), align: 'right' },
    {
      header: 'Suggested',
      align: 'right',
      cell: (s) => (
        <button
          type="button"
          aria-pressed={s.isActive}
          disabled={busy}
          onClick={() =>
            (s.isActive ? deactivate : activate).mutate({ id: s.id, label: s.label })
          }
          className={`rounded-md border px-2 py-1 text-[11px] font-bold transition-colors disabled:opacity-40 ${
            s.isActive
              ? 'border-primary/40 bg-primary/15 text-primary'
              : 'border-surface-border text-text-muted hover:bg-surface-2'
          }`}
        >
          {s.isActive ? 'On' : 'Off'}
        </button>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <PageHeader
        title="Popular searches"
        query={query}
        total={searches.length}
        noun="suggestions"
        actions={
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Region
            </span>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="All"
              className="w-24 rounded-lg border border-surface-border bg-bg-elevated px-3 py-2 text-sm font-normal tracking-normal text-text-primary placeholder:text-text-muted"
            />
          </label>
        }
      />

      <div className="overflow-hidden rounded-xl border border-surface-border bg-bg-card">
        <ListState
          query={query}
          isEmpty={searches.length === 0}
          noun="popular searches"
          emptyTitle={
            region ? `No suggestions configured for ${region}.` : 'No suggestions configured.'
          }
        >
          <DataTable rows={searches} columns={columns} rowKey={(s) => s.id} />
        </ListState>
      </div>

      <p className="text-xs text-text-muted">
        Adding and editing suggestions is not wired up yet — the endpoints exist. Toggling takes
        effect immediately.
      </p>
    </section>
  );
}
