import { useBriefDetail } from '@/api/queries/useBriefDetail'
import { BriefStatusBadge } from './BriefStatusBadge'
import type { BriefId } from '@/lib/brands'

interface BriefEditorRootProps {
  briefId: BriefId
}

export function BriefEditorRoot({ briefId }: BriefEditorRootProps) {
  const { data: brief, isPending, isError } = useBriefDetail(briefId)

  if (isPending) return <BriefEditorSkeleton />
  if (isError)   return <div className="p-6 text-[var(--text-muted)]">Brief not found.</div>

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          {brief.title ?? 'Untitled'}
        </h1>
        <BriefStatusBadge state={brief.state} />
        <span className="text-xs text-[var(--text-muted)]">v{brief.version}</span>
      </div>

      {/* TODO: BriefEditor form with dirtyFields PATCH */}
      <div className="max-w-2xl rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <p className="text-sm text-[var(--text-muted)]">Brief editor — coming soon.</p>
      </div>
    </div>
  )
}

function BriefEditorSkeleton() {
  return (
    <div className="p-6 space-y-4" aria-busy="true" aria-label="Loading brief">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-[var(--surface-2)]" />
      <div className="h-96 animate-pulse rounded-xl bg-[var(--surface-2)]" />
    </div>
  )
}
