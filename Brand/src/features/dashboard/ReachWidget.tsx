import { Eye, Users } from 'lucide-react'
import { formatCompact, formatPercent } from '@/lib/formatters'
import type { ReachDiagnosticsSummary } from '@/api/schema'

interface ReachWidgetProps {
  reach: ReachDiagnosticsSummary
}

export function ReachWidget({ reach }: ReachWidgetProps) {
  const growthUp = (reach.audienceGrowthRate ?? 0) >= 0

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <WidgetHeader icon={<Eye className="h-3.5 w-3.5 text-[var(--primary)]" />} label="Reach" />

      <div className="space-y-4">
        <KpiBig
          icon={<Eye className="h-4 w-4 text-[var(--text-muted)]" />}
          label="Impressions"
          value={formatCompact(reach.totalImpressions)}
        />
        <KpiBig
          icon={<Users className="h-4 w-4 text-[var(--text-muted)]" />}
          label="Unique Audience"
          value={formatCompact(reach.uniqueAudience)}
        />

        <div>
          <p className="mb-0.5 text-xs text-[var(--text-muted)]">Audience Growth</p>
          <p
            className="text-xl font-bold"
            style={{ color: growthUp ? 'var(--primary)' : 'var(--text-muted)' }}
          >
            {growthUp ? '↑' : '↓'} {formatPercent(reach.audienceGrowthRate)}
          </p>
        </div>
      </div>

      {reach.topRegions && reach.topRegions.length > 0 && (
        <div
          className="mt-4 pt-4"
          style={{ borderTop: '1px solid var(--surface-border)' }}
        >
          <p className="mb-2 text-xs text-[var(--text-muted)]">Top regions</p>
          <div className="flex flex-wrap gap-1.5">
            {reach.topRegions.map((r) => (
              <span
                key={r}
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function WidgetHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div
        className="flex h-7 w-7 items-center justify-center rounded-lg"
        style={{ background: 'var(--surface-3)' }}
      >
        {icon}
      </div>
      <p className="text-sm font-semibold text-[var(--text-secondary)]">{label}</p>
    </div>
  )
}

function KpiBig({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
        <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
      </div>
    </div>
  )
}
