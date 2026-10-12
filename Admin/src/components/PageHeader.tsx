import type { ReactNode } from 'react';
import type { QueryLike } from './ListState';

/**
 * The page title and its count.
 *
 * One component, so every page is the same size and the browser tab,
 * the heading and the sidebar cannot disagree about what a page is
 * called. The count routes through the query's state for the same
 * reason `ListState` does: `?? 0` turns "we never found out" into
 * "zero", in the one place a reader takes at face value.
 */
export function PageHeader({
  title,
  query,
  total,
  noun = 'in queue',
  actions,
}: {
  title: string;
  query?: QueryLike;
  total?: number | undefined;
  noun?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-text-primary">{title}</h1>
        {query && <p className="mt-1 text-xs text-text-muted">{countLabel(query, total, noun)}</p>}
      </div>
      {actions}
    </header>
  );
}

function countLabel(query: QueryLike, total: number | undefined, noun: string): string {
  if (query.isError || query.fetchStatus === 'paused') return 'Count unavailable';
  if (query.isPending ?? query.isLoading) return 'Loading…';
  if (total === undefined) return 'Count unavailable';
  return `${total.toLocaleString()} ${noun}`;
}
