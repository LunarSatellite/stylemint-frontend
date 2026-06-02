import type { PredictedAudienceSegment } from '@/api/schema'
import { formatPercent } from '@/lib/formatters'

interface PredictedAudienceCardProps {
  segments: PredictedAudienceSegment[]
}

export function PredictedAudienceCard({ segments }: PredictedAudienceCardProps) {
  return (
    <div className="rounded-xl bg-bg-card p-4">
      <h3 className="text-sm font-medium text-text-secondary mb-3">Predicted Audience</h3>
      <ul className="space-y-2">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between">
            <span className="text-sm text-text-primary">{s.label}</span>
            <span className="text-sm font-medium text-primary">{formatPercent(s.fraction)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
