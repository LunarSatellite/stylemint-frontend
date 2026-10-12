import type { ReactNode } from 'react';

/**
 * Telling "it failed" apart from "there are none".
 *
 * This exists on day one because of what the alternative looks like in
 * practice. In the console this replaces, every list was written as
 *
 *   {isLoading ? <spinner/> : !items.length ? <Empty/> : <table/>}
 *
 * and with the API unreachable the invoices page said "No invoices
 * found" under a heading reading "0 total". An empty spinner is a bad
 * state; a wrong answer delivered calmly is worse, because the
 * operator has no reason to doubt it.
 *
 * React Query has four outcomes, not three. When it decides the
 * connection is down it *pauses* the query, and a paused query reports
 * `isPending: true, isLoading: false, isError: false` — `isLoading` is
 * false by design, because nothing is in flight. A component branching
 * on `isLoading` alone therefore renders its empty state for every
 * list in the product the moment the network drops.
 *
 * So all four are handled here, once, and no screen decides it again.
 */
export interface QueryLike {
  isPending?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  fetchStatus?: 'fetching' | 'paused' | 'idle';
  refetch?: () => unknown;
}

export function ListState({
  query,
  isEmpty,
  noun,
  emptyTitle,
  children,
}: {
  query: QueryLike;
  isEmpty: boolean;
  /** Plain plural, with no article: it lands in "your {noun}". */
  noun: string;
  emptyTitle: string;
  children: ReactNode;
}) {
  // Everything that is not a successful answer is checked before
  // emptiness. A list that failed is also a list with no rows, so the
  // other order quietly restores the bug this prevents.
  if (query.isError) {
    return (
      <Notice
        title={`Could not load ${noun}`}
        body={`The request failed, so this is not showing your ${noun}. The list is not empty.`}
        onRetry={query.refetch}
      />
    );
  }

  if (query.fetchStatus === 'paused') {
    return (
      <Notice
        title="Waiting for a connection"
        body={`This is not showing your ${noun} — the request is paused until the network is back. The list is not empty.`}
        onRetry={query.refetch}
      />
    );
  }

  if (query.isPending ?? query.isLoading) {
    return (
      <p className="px-6 py-12 text-center text-sm text-text-muted">Loading {noun}…</p>
    );
  }

  if (isEmpty) {
    return <p className="px-6 py-12 text-center text-sm text-text-muted">{emptyTitle}</p>;
  }

  return <>{children}</>;
}

function Notice({
  title,
  body,
  onRetry,
}: {
  title: string;
  body: string;
  onRetry?: (() => unknown) | undefined;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-bold text-text-primary">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-text-secondary">{body}</p>
      {onRetry && (
        <button
          type="button"
          onClick={() => onRetry()}
          className="mt-4 rounded-lg border border-border-primary px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light"
        >
          Try again
        </button>
      )}
    </div>
  );
}
