import { useFeatureFlags, type FeatureFlag } from '@/api/queries/useFeatureFlags';
import { DataTable, type Column } from '@/components/DataTable';
import { ListState } from '@/components/ListState';
import { PageHeader } from '@/components/PageHeader';
import { utcDate } from '@/lib/dates';

const columns: Column<FeatureFlag>[] = [
  {
    header: 'Key',
    cell: (r) => <code className="font-semibold text-text-primary">{r.key}</code>,
  },
  { header: 'Description', cell: (r) => r.description ?? '—' },
  {
    header: 'Default',
    cell: (r) =>
      r.defaultEnabled ? (
        <span className="text-primary">On</span>
      ) : (
        <span className="text-text-muted">Off</span>
      ),
  },
  {
    header: 'Overrides',
    cell: (r) => (r.overrides?.length ? `${r.overrides.length}` : 'None'),
    align: 'right',
  },
  { header: 'Updated', cell: (r) => utcDate(r.updatedUtc ?? r.createdUtc), align: 'right' },
];

/**
 * What is switched on, and for whom.
 *
 * Read-only. Writing a flag is `PUT /feature-flags/{key}` with a
 * `rowVersion`, and an override is a second endpoint with its own
 * audience model — turning a flag on for everyone by accident is the
 * kind of mistake a toggle with no confirmation invites.
 */
export function FeatureFlagsPage() {
  const query = useFeatureFlags();
  const flags = query.data ?? [];

  return (
    <section className="space-y-4">
      <PageHeader title="Feature flags" query={query} total={flags.length} noun="flags" />

      <div className="overflow-hidden rounded-xl border border-surface-border bg-bg-card">
        <ListState
          query={query}
          isEmpty={flags.length === 0}
          noun="feature flags"
          emptyTitle="No flags defined."
        >
          <DataTable rows={flags} columns={columns} rowKey={(r) => r.id} />
        </ListState>
      </div>

      <p className="text-xs text-text-muted">
        Editing a flag or its audience overrides is not wired up yet.
      </p>
    </section>
  );
}
