import type { HookSuggestion } from '@/api/schema'
import { HookScoreBadge } from './HookScoreBadge'
import { ExplanationTooltip } from '@/components/ExplanationTooltip'

interface HookCarouselProps {
  suggestions: HookSuggestion[]
}

export function HookCarousel({ suggestions }: HookCarouselProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {suggestions.map((s, i) => (
        <div key={i} className="min-w-64 rounded-xl bg-bg-card p-4">
          <ExplanationTooltip explanations={s.explanationByKey} featureKey="hookScore">
            <HookScoreBadge score={s.hookScore} label="Hook Score" />
          </ExplanationTooltip>
          <p className="mt-3 text-sm text-text-primary">{s.text}</p>
        </div>
      ))}
    </div>
  )
}
