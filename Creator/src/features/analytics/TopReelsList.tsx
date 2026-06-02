import { Link } from 'react-router-dom'
import type { TopReelDto } from '@/api/schema'
import { formatPercent } from '@/lib/formatters'

interface TopReelsListProps {
  reels: TopReelDto[]
}

export function TopReelsList({ reels }: TopReelsListProps) {
  return (
    <div className="rounded-xl bg-bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">Top Reels</h3>
      <ul className="space-y-3">
        {reels.map((r) => (
          <li key={r.reelId}>
            <Link to={`/analytics/reels/${r.reelId}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              {r.thumbnailUrl && (
                <img src={r.thumbnailUrl} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{r.title}</p>
                <p className="text-xs text-text-muted">{r.views.toLocaleString()} views · {formatPercent(r.conversionRate)}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-primary">{r.earningsFormatted}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
