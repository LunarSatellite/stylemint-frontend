import type { StitchedReelSuggestionDto } from '@/api/schema'
import { useAcknowledgeStitch } from '@/api/mutations/useAcknowledgeStitch'
import { useDismissStitch } from '@/api/mutations/useDismissStitch'
import { Button } from '@/components/ui/button'
import { formatPercent } from '@/lib/formatters'

interface StitchedReelSuggestionCardProps {
  suggestion: StitchedReelSuggestionDto
}

export function StitchedReelSuggestionCard({ suggestion: s }: StitchedReelSuggestionCardProps) {
  const { mutate: acknowledge, isPending: acknowledging } = useAcknowledgeStitch()
  const { mutate: dismiss,     isPending: dismissing }    = useDismissStitch()

  return (
    <div className="rounded-xl bg-bg-card p-4">
      <img
        src={s.candidateReelThumbnailUrl ?? '/placeholder-reel.png'}
        alt=""
        className="h-32 w-full rounded-lg object-cover"
      />
      <p className="mt-2 text-sm font-medium text-text-primary">
        {s.candidateCreatorDisplayName ?? 'Creator unavailable'}
      </p>
      <p className="text-xs text-text-muted">{formatPercent(s.compatibilityScore)} compatibility</p>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          onClick={() => acknowledge(s.id)}
          loading={acknowledging}
        >
          Interested
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dismiss({ id: s.id })}
          loading={dismissing}
        >
          Dismiss
        </Button>
      </div>
    </div>
  )
}
