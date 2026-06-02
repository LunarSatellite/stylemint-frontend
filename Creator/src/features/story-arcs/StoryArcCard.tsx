import { Link } from 'react-router-dom'
import type { StoryArcDto } from '@/api/schema'
import { StoryArcState } from '@/lib/enums'
import { cn } from '@/lib/utils'
import { MoneyDisplay } from '@/components/MoneyDisplay'

interface StoryArcCardProps {
  arc: StoryArcDto
}

const stateLabel: Record<StoryArcState, string> = {
  [StoryArcState.Suggested]:  'New',
  [StoryArcState.Active]:     'In Progress',
  [StoryArcState.Completed]:  'Done',
  [StoryArcState.Dropped]:    'Dropped',
}

export function StoryArcCard({ arc }: StoryArcCardProps) {
  return (
    <Link
      to={`/story-arcs/${arc.id}`}
      className="block rounded-xl bg-bg-card p-4 transition-colors hover:bg-bg-elevated"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-text-primary">{arc.title}</p>
          <p className="mt-1 text-xs text-text-muted">{arc.theme}</p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
            arc.state === StoryArcState.Active    && 'bg-primary/20 text-primary',
            arc.state === StoryArcState.Suggested && 'bg-surface-2 text-text-secondary',
            arc.state === StoryArcState.Completed && 'bg-green-900/40 text-green-400',
            arc.state === StoryArcState.Dropped   && 'bg-surface-1 text-text-muted',
          )}
        >
          {stateLabel[arc.state]}
        </span>
      </div>
      <MoneyDisplay formatted={arc.commissionEarnedFormatted} className="mt-3 text-sm font-semibold text-primary" />
    </Link>
  )
}
