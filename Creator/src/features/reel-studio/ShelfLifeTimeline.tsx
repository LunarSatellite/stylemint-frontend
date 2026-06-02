import type { ShelfLifePoint } from '@/api/schema'
import { formatPercent } from '@/lib/formatters'

interface ShelfLifeTimelineProps {
  points: ShelfLifePoint[]
}

export function ShelfLifeTimeline({ points }: ShelfLifeTimelineProps) {
  return (
    <div className="rounded-xl bg-bg-card p-4">
      <h3 className="text-sm font-medium text-text-secondary mb-3">Shelf Life</h3>
      <div className="flex items-end gap-1 h-20">
        {points.map((p) => (
          <div key={p.dayOffset} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-sm bg-primary/60"
              style={{ height: `${p.retentionRate * 100}%` }}
              title={`Day ${p.dayOffset}: ${formatPercent(p.retentionRate)}`}
            />
            <span className="text-[10px] text-text-muted">{p.dayOffset}d</span>
          </div>
        ))}
      </div>
    </div>
  )
}
