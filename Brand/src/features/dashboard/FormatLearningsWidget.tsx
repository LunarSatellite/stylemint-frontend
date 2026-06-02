import { formatPercent } from '@/lib/formatters'
import type { FormatLearningRow } from '@/api/schema'

interface FormatLearningsWidgetProps {
  rows: FormatLearningRow[]
}

export function FormatLearningsWidget({ rows }: FormatLearningsWidgetProps) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Format Learnings</p>
      {rows.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">No data yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[var(--text-primary)]">
                  {row.formatLabel ?? 'Unknown'}
                </p>
                <span className="text-xs text-[var(--text-muted)]">{row.count} reels</span>
              </div>
              <div className="mt-1 flex gap-4">
                <span className="text-xs text-[var(--text-muted)]">
                  Completion {formatPercent(row.avgCompletionRate)}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  CVR {formatPercent(row.avgConversionRate)}
                </span>
              </div>
              {row.takeaway && (
                <p className="mt-1 text-xs text-[var(--primary)]">{row.takeaway}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
