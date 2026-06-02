import { useServerAnchoredCountdown } from '@/hooks/useServerAnchoredCountdown'
import { formatMs } from '@/lib/formatters'

interface BoostCountdownProps {
  serverNowUtc: string
  expiresUtc: string
}

export function BoostCountdown({ serverNowUtc, expiresUtc }: BoostCountdownProps) {
  const remaining = useServerAnchoredCountdown(serverNowUtc, expiresUtc)

  return (
    <p className="text-text-muted text-sm">
      Expires in <span className="font-mono text-text-secondary">{formatMs(remaining)}</span>
    </p>
  )
}
