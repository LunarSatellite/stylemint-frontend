import { BarChart2 } from 'lucide-react'
import { formatPercent } from '@/lib/formatters'
import type { CompetitiveBenchmarkSummary } from '@/api/schema'

interface BenchmarkWidgetProps {
  benchmark: CompetitiveBenchmarkSummary
}

export function BenchmarkWidget({ benchmark }: BenchmarkWidgetProps) {
  const max = Math.max(
    benchmark.yourAvgConversion ?? 0,
    benchmark.cohortMedianConversion ?? 0,
    benchmark.cohortTopQuartileConversion ?? 0,
    0.01,
  )

  const rows: Array<{ label: string; value: number | null; isYou: boolean }> = [
    { label: 'Your CVR',       value: benchmark.yourAvgConversion,             isYou: true  },
    { label: 'Cohort Median',  value: benchmark.cohortMedianConversion,        isYou: false },
    { label: 'Top Quartile',   value: benchmark.cohortTopQuartileConversion,   isYou: false },
  ]

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="mb-4 flex items-start gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'var(--surface-3)' }}
        >
          <BarChart2 className="h-3.5 w-3.5 text-[var(--primary)]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--text-secondary)]">Benchmark</p>
          {benchmark.cohortLabel && (
            <p className="text-xs text-[var(--text-muted)]">vs {benchmark.cohortLabel}</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {rows.map(({ label, value, isYou }) => {
          const pct = value == null ? 0 : (value / max) * 100
          return (
            <div key={label}>
              <div className="mb-1 flex items-center justify-between">
                <span
                  className="text-xs font-medium"
                  style={{ color: isYou ? 'var(--primary)' : 'var(--text-muted)' }}
                >
                  {label}
                </span>
                <span
                  className="text-xs font-bold"
                  style={{ color: isYou ? 'var(--primary)' : 'var(--text-primary)' }}
                >
                  {formatPercent(value)}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full"
                style={{ background: 'var(--surface-3)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: isYou ? 'var(--primary)' : 'var(--surface-border)',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {benchmark.takeaway && (
        <p
          className="mt-4 rounded-lg px-3 py-2 text-xs"
          style={{ background: 'var(--surface-2)', color: 'var(--primary)' }}
        >
          {benchmark.takeaway}
        </p>
      )}

      <p className="mt-3 text-xs text-[var(--text-muted)]">
        {benchmark.cohortMemberCount} vendors in cohort
      </p>
    </div>
  )
}
