import type { PostTimeRecommendation } from '@/api/schema'
import { formatInAudienceTz } from '@/lib/formatters'
import { ExplanationTooltip } from '@/components/ExplanationTooltip'
import { formatPercent } from '@/lib/formatters'

interface PostTimeCardsProps {
  recommendations: PostTimeRecommendation[]
}

export function PostTimeCards({ recommendations }: PostTimeCardsProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {recommendations.map((r, i) => (
        <div key={i} className="min-w-48 rounded-xl bg-bg-card p-4">
          <ExplanationTooltip explanations={r.explanationByKey} featureKey="audienceScore">
            <p className="text-xs text-text-muted">Audience online</p>
          </ExplanationTooltip>
          <p className="mt-1 text-xl font-bold text-primary">{formatPercent(r.audienceOnlineScore)}</p>
          <p className="mt-2 text-sm text-text-secondary">
            {formatInAudienceTz(r.suggestedAtUtc, r.timeZone)}
          </p>
        </div>
      ))}
    </div>
  )
}
