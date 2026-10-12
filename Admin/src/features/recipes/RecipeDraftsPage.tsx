import { useState } from 'react';
import { useRecipeDrafts, type ReelRecipe } from '@/api/queries/useRecipeDrafts';
import { useHideRecipe, usePromoteRecipe } from '@/api/mutations/useRecipeActions';
import { DataTable, type Column } from '@/components/DataTable';
import { ListState } from '@/components/ListState';
import { PageHeader } from '@/components/PageHeader';
import { ConfirmDialog, type ConfirmRequest } from '@/components/ConfirmDialog';
import { RecipeOriginLabel, labelOf } from '@/lib/formatters';

/**
 * Reel recipes a model wrote, waiting for a person to sign them off.
 *
 * Promoting one is not a formality: it moves the recipe from
 * `LlmDrafted` to `PlatformCurated`, which is the platform saying this
 * is ours. The confirmation says that in those words, because
 * "approve" invites clicking through a queue, and the thing being
 * approved is content the platform will stand behind.
 *
 * The counts of beats, captions and adaptations are shown because
 * they are the cheap signal of whether a draft is complete. The
 * recipe's actual content needs a detail view, and there is a read
 * for it; this queue is the triage in front of that.
 */
export function RecipeDraftsPage() {
  const [skip, setSkip] = useState(0);
  const take = 25;
  const query = useRecipeDrafts(skip, take);
  const drafts = query.data ?? [];

  const promote = usePromoteRecipe();
  const hide = useHideRecipe();

  const [pending, setPending] = useState<
    { request: ConfirmRequest; run: (reason: string) => void } | null
  >(null);

  const columns: Column<ReelRecipe>[] = [
    {
      header: 'Recipe',
      cell: (r) => <span className="font-semibold text-text-primary">{r.title}</span>,
    },
    { header: 'Origin', cell: (r) => labelOf(RecipeOriginLabel, r.origin) },
    { header: 'Beats', cell: (r) => String(r.beats?.length ?? 0), align: 'right' },
    {
      header: 'Captions',
      cell: (r) => String(r.captionVariants?.length ?? 0),
      align: 'right',
    },
    {
      header: 'Platforms',
      cell: (r) => String(r.platformAdaptations?.length ?? 0),
      align: 'right',
    },
    {
      header: 'Decide',
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={() =>
              setPending({
                request: {
                  title: `Make "${r.title}" platform curated?`,
                  body: 'A model wrote this. Promoting it means the platform stands behind it and it can be recommended as ours. Read it first.',
                  confirmLabel: 'Promote to curated',
                },
                run: () => promote.mutate({ id: r.id, title: r.title }),
              })
            }
            className="rounded-md border border-surface-border px-2 py-1 text-[11px] font-bold text-text-secondary hover:bg-surface-2"
          >
            Promote
          </button>
          <button
            type="button"
            onClick={() =>
              setPending({
                request: {
                  title: `Hide "${r.title}"?`,
                  body: 'The draft stops appearing anywhere. It is not deleted and can be unhidden.',
                  confirmLabel: 'Hide draft',
                  tone: 'danger',
                  requireReason: true,
                },
                run: (reason) => hide.mutate({ id: r.id, title: r.title, reason }),
              })
            }
            className="rounded-md border border-red-500/30 px-2 py-1 text-[11px] font-bold text-red-300 hover:bg-red-500/10"
          >
            Hide
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <PageHeader
        title="Recipe drafts"
        query={query}
        total={drafts.length}
        noun="awaiting review"
      />

      <div className="overflow-hidden rounded-xl border border-surface-border bg-bg-card">
        <ListState
          query={query}
          isEmpty={drafts.length === 0}
          noun="recipe drafts"
          emptyTitle="No drafts are waiting for review."
        >
          <DataTable rows={drafts} columns={columns} rowKey={(r) => r.id} />
        </ListState>
      </div>

      {/* skip/take, so paging is backwards and forwards rather than a
          jump to a numbered page the endpoint cannot serve. */}
      {(skip > 0 || drafts.length === take) && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={skip === 0}
            onClick={() => setSkip((s) => Math.max(0, s - take))}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-bold text-text-secondary hover:bg-surface-2 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={drafts.length < take}
            onClick={() => setSkip((s) => s + take)}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-bold text-text-secondary hover:bg-surface-2 disabled:opacity-40"
          >
            Next
          </button>
        </div>
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
