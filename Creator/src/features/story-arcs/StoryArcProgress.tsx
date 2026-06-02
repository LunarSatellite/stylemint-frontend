import type { StoryArcMilestone } from '@/api/schema'

interface StoryArcProgressProps {
  milestones: StoryArcMilestone[]
}

export function StoryArcProgress({ milestones }: StoryArcProgressProps) {
  const total   = milestones.length
  const reached = milestones.filter((m) => m.reached).length

  return (
    <div className="rounded-xl bg-bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-text-secondary">Progress</span>
        <span className="text-sm font-medium text-text-primary">{reached}/{total}</span>
      </div>
      <div className="flex gap-1.5">
        {milestones.map((m) => (
          <div
            key={m.reelCount}
            title={m.label}
            className={`h-2 flex-1 rounded-full ${m.reached ? 'bg-primary' : 'bg-surface-2'}`}
          />
        ))}
      </div>
    </div>
  )
}
