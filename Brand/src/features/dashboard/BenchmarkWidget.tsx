import { formatPercent } from '@/lib/formatters'
import type { CompetitiveBenchmarkSummary } from '@/api/schema'

interface BenchmarkWidgetProps {
  benchmark: CompetitiveBenchmarkSummary
}

export function BenchmarkWidget({ benchmark }: BenchmarkWidgetProps) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
        Benchmark
        {benchmark.cohortLabel && (
          <span className="ml-2 text-xs text-[var(--text-muted)]">vs {benchmark.cohortLabel}</span>
        )}
      </p>
      <div className="space-y-2">
        <BenchmarkRow label="Your CVR"      value={formatPercent(benchmark.yourAvgConversion)} />
        <BenchmarkRow label="Cohort Median" value={formatPercent(benchmark.cohortMedianConversion)} />
        <BenchmarkRow label="Top Quartile"  value={formatPercent(benchmark.cohortTopQuartileConversion)} />
      </div>
      {benchmark.takeaway && (
        <p className="mt-3 text-xs text-[var(--primary)]">{benchmark.takeaway}</p>
      )}
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        {benchmark.cohortMemberCount} vendors in cohort
      </p>
    </div>
  )
}

function BenchmarkRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span className="text-xs font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  )
}
