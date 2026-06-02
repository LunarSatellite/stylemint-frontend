import type { EarningsTrendPoint } from '@/api/schema'

interface EarningsTrendChartProps {
  series: EarningsTrendPoint[]
}

export function EarningsTrendChart({ series }: EarningsTrendChartProps) {
  if (!series.length) return null

  const max = Math.max(...series.map((p) => Number(p.earningsFormatted.replace(/[^0-9.]/g, '')) || 0))

  return (
    <div className="rounded-xl bg-bg-card p-4">
      <h3 className="mb-4 text-sm font-medium text-text-secondary">Earnings Trend</h3>
      <div className="flex items-end gap-1 h-28">
        {series.map((p, i) => {
          const raw = Number(p.earningsFormatted.replace(/[^0-9.]/g, '')) || 0
          const pct = max > 0 ? (raw / max) * 100 : 0
          return (
            <div
              key={i}
              className="flex-1 rounded-sm bg-primary/70 hover:bg-primary transition-colors cursor-default"
              style={{ height: `${Math.max(pct, 2)}%` }}
              title={p.earningsFormatted}
            />
          )
        })}
      </div>
    </div>
  )
}
