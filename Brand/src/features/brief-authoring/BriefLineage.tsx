import { cn } from '@/lib/cn'
import type { BrandBriefDto } from '@/api/schema'

interface BriefLineageProps {
  brief:     BrandBriefDto
  className?: string
}

export function BriefLineage({ brief, className }: BriefLineageProps) {
  const isForked = brief.parentBriefId !== null
  const isRoot   = brief.rootBriefId === brief.id

  return (
    <div className={cn('flex items-center gap-2 text-xs text-[var(--text-muted)]', className)}>
      {isRoot ? (
        <span>v{brief.version} · Original</span>
      ) : isForked ? (
        <span>v{brief.version} · Forked</span>
      ) : (
        <span>v{brief.version}</span>
      )}
    </div>
  )
}
