import { cn } from '@/lib/utils'
import { formatPercent } from '@/lib/formatters'

export interface HookScoreBadgeProps {
  score: number
  label: string
  className?: string
}

export function HookScoreBadge({ score, label, className }: HookScoreBadgeProps) {
  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1', className)}>
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-sm font-semibold text-primary">{formatPercent(score)}</span>
    </div>
  )
}
