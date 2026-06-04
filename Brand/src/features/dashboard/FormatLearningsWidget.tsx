import { Lightbulb } from 'lucide-react'
import { formatPercent } from '@/lib/formatters'
import type { FormatLearningRow } from '@/api/schema'

interface FormatLearningsWidgetProps {
  rows: FormatLearningRow[]
}

export function FormatLearningsWidget({ rows }: FormatLearningsWidgetProps) {
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
          <Lightbulb className="h-3.5 w-3.5 text-[var(--primary)]" />
        </div>
        <p className="text-sm font-semibold text-[var(--text-secondary)]">Format Learnings</p>
      </div>

      {rows.length === 0 ? (
        <WidgetEmpty label="No data yet" />
      ) : (
        <div className="space-y-4">
          {rows.map((row, i) => (
            <div key={i}>
              <div className="mb-2 flex items-center justify-between">
                <span
                  className="rounded-md px-2 py-0.5 text-xs font-semibold"
                  style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
                >
                  {row.formatLabel ?? 'Unknown'}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{row.count} reels</span>
              </div>

              <div className="space-y-1.5">
                <RateBar
                  label="Completion"
                  value={row.avgCompletionRate}
                  formatted={formatPercent(row.avgCompletionRate)}
                />
                <RateBar
                  label="CVR"
                  value={row.avgConversionRate}
                  formatted={formatPercent(row.avgConversionRate)}
                />
              </div>

              {row.takeaway && (
                <p className="mt-2 text-xs text-[var(--primary)]">{row.takeaway}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RateBar({
  label,
  value,
  formatted,
}: {
  label: string
  value: number | null
  formatted: string
}) {
  const pct = value == null ? 0 : Math.min(value * 100, 100)
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-[var(--text-muted)]">{label}</span>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full"
        style={{ background: 'var(--surface-3)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'var(--primary)' }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-medium text-[var(--text-primary)]">
        {formatted}
      </span>
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
