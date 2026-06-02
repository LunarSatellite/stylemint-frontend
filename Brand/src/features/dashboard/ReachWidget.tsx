import { formatCompact, formatPercent } from '@/lib/formatters'
import type { ReachDiagnosticsSummary } from '@/api/schema'

interface ReachWidgetProps {
  reach: ReachDiagnosticsSummary
}

export function ReachWidget({ reach }: ReachWidgetProps) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Reach</p>
      <div className="space-y-2">
        <StatRow label="Impressions"     value={formatCompact(reach.totalImpressions)} />
        <StatRow label="Unique Audience" value={formatCompact(reach.uniqueAudience)} />
        <StatRow label="Growth"          value={formatPercent(reach.audienceGrowthRate)} />
      </div>
      {reach.topRegions && reach.topRegions.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-[var(--text-muted)]">Top regions</p>
          <p className="mt-1 text-xs text-[var(--text-primary)]">{reach.topRegions.join(', ')}</p>
        </div>
      )}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span className="text-xs font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  )
}
