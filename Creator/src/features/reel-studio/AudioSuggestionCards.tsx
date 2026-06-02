import type { AudioSuggestionCard } from '@/api/schema'
import { Button } from '@/components/ui/button'
import { formatPercent } from '@/lib/formatters'

interface AudioSuggestionCardsProps {
  cards: AudioSuggestionCard[]
}

export function AudioSuggestionCards({ cards }: AudioSuggestionCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card) => (
        <div key={card.id} className="rounded-xl bg-bg-card p-4">
          <p className="font-medium text-text-primary text-sm">{card.title}</p>
          <p className="text-xs text-text-muted">{card.artistName}</p>
          <p className="mt-1 text-xs text-text-secondary">{formatPercent(card.matchScore)} match</p>
          {card.externalListenUrl && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => window.open(card.externalListenUrl!, '_blank', 'noopener,noreferrer')}
            >
              Listen
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
