import type { SuggestedCreatorRow } from '@/api/schema'

interface SuggestedCreatorsWidgetProps {
  rows: SuggestedCreatorRow[]
}

export function SuggestedCreatorsWidget({ rows }: SuggestedCreatorsWidgetProps) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Suggested Creators</p>
      {rows.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">No suggestions yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.creatorAccountId} className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                  {row.creatorHandle ?? row.creatorAccountId.slice(0, 8)}
                </p>
                {row.topThreeReasons && (
                  <p className="truncate text-xs text-[var(--text-muted)]">{row.topThreeReasons}</p>
                )}
              </div>
              <span className="ml-3 shrink-0 text-xs font-medium text-[var(--primary)]">
                {(row.matchScore * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
