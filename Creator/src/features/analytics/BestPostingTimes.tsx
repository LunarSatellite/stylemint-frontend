import type { BestPostingSlot } from '@/api/schema'
import { formatPercent } from '@/lib/formatters'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface BestPostingTimesProps {
  slots: BestPostingSlot[]
}

export function BestPostingTimes({ slots }: BestPostingTimesProps) {
  const sorted = [...slots].sort((a, b) => b.audienceScore - a.audienceScore).slice(0, 5)

  return (
    <div className="rounded-xl bg-bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">Best Posting Times</h3>
      <ul className="space-y-2">
        {sorted.map((s, i) => (
          <li key={i} className="flex items-center justify-between">
            <span className="text-sm text-text-primary">
              {DAYS[s.dayOfWeek]} {String(s.hourLocal).padStart(2, '0')}:00
            </span>
            <span className="text-sm font-medium text-primary">{formatPercent(s.audienceScore)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
