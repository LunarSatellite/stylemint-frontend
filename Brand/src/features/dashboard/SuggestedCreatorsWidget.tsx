import { Sparkles } from 'lucide-react'
import type { SuggestedCreatorRow } from '@/api/schema'

interface SuggestedCreatorsWidgetProps {
  rows: SuggestedCreatorRow[]
}

export function SuggestedCreatorsWidget({ rows }: SuggestedCreatorsWidgetProps) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="mb-4 flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: 'var(--surface-3)' }}
        >
          <Sparkles className="h-3.5 w-3.5 text-[var(--primary)]" />
        </div>
        <p className="text-sm font-semibold text-[var(--text-secondary)]">Suggested Creators</p>
      </div>

      {rows.length === 0 ? (
        <WidgetEmpty label="No suggestions yet" />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const score = (row.matchScore * 100).toFixed(0)
            const handle = row.creatorHandle ?? row.creatorAccountId.slice(0, 8)
            const initials = handle.slice(0, 2).toUpperCase()

            return (
              <div
                key={row.creatorAccountId}
                className="flex items-center gap-3 rounded-lg p-2.5"
                style={{ background: 'var(--surface-1)' }}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    background: 'var(--surface-3)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {initials}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                    {handle}
                  </p>
                  {row.topThreeReasons && (
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {row.topThreeReasons}
                    </p>
                  )}
                </div>

                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold"
                  style={{ background: 'var(--glow-primary)', color: 'var(--primary)' }}
                >
                  {score}%
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function WidgetEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-16 items-center justify-center">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  )
}
