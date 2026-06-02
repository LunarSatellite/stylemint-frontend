import type { ConvertingSegment } from '@/api/schema'
import { formatMs, formatPercent } from '@/lib/formatters'

interface ConvertingSegmentsSectionProps {
  segments: ConvertingSegment[]
}

export function ConvertingSegmentsSection({ segments }: ConvertingSegmentsSectionProps) {
  return (
    <div className="rounded-xl bg-bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">Converting Segments</h3>
      <ul className="space-y-2">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center justify-between">
            <span className="font-mono text-xs text-text-muted">
              {formatMs(s.startMs)} – {formatMs(s.endMs)}
            </span>
            <span className="text-sm font-medium text-primary">{formatPercent(s.conversionRate)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
