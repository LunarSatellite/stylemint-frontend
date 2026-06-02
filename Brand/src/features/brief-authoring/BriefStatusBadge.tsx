import { Badge } from '@/components/ui/Badge'
import { BrandBriefState } from '@/lib/enums'
import type { ValueOf } from '@/lib/types'

interface BriefStatusBadgeProps {
  state:     ValueOf<typeof BrandBriefState>
  className?: string
}

export function BriefStatusBadge({ state, className }: BriefStatusBadgeProps) {
  switch (state) {
    case BrandBriefState.Draft:
      return <Badge variant="warning" className={className}>Draft</Badge>
    case BrandBriefState.Locked:
      return <Badge variant="success" className={className}>Locked</Badge>
    case BrandBriefState.Retired:
      return <Badge variant="muted" className={className}>Retired</Badge>
    default: {
      const _: never = state
      throw new Error(`Unhandled BrandBriefState: ${String(_)}`)
    }
  }
}
