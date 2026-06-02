import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useBriefList } from '@/api/queries/useBriefList'
import { Button } from '@/components/ui/Button'
import { BriefStatusBadge } from './BriefStatusBadge'

export function BriefListRoot() {
  const { data, isPending, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useBriefList()

  const briefs = data?.pages.flatMap((p) => p.items) ?? []

  if (isPending) return <BriefListSkeleton />
  if (isError)   return <div className="p-6 text-[var(--text-muted)]">Failed to load briefs.</div>

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Briefs</h1>
        <Button size="sm" onClick={() => void 0}>
          <Link to="/briefs/new" className="flex items-center gap-1">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Brief
          </Link>
        </Button>
      </div>

      {briefs.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No briefs yet.</p>
      ) : (
        <div className="space-y-2">
          {briefs.map((brief) => (
            <Link
              key={brief.id}
              to={`/briefs/${brief.id}`}
              className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{brief.title ?? 'Untitled'}</p>
                <p className="text-xs text-[var(--text-muted)]">v{brief.version}</p>
              </div>
              <BriefStatusBadge state={brief.state} />
            </Link>
          ))}

          {hasNextPage && (
            <div className="pt-4 text-center">
              <Button variant="secondary" size="sm" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BriefListSkeleton() {
  return (
    <div className="p-6 space-y-2" aria-busy="true" aria-label="Loading briefs">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-[var(--surface-2)]" />
      ))}
    </div>
  )
}
