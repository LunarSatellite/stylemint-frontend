import { useEffect, useMemo, useState } from 'react'

export function useServerAnchoredCountdown(serverNowUtc: string, expiresUtc: string): number {
  const serverAnchor = useMemo(() => new Date(serverNowUtc).getTime(), [serverNowUtc])
  const deviceAnchor = useMemo(() => Date.now(), [serverNowUtc])
  const expiresAt    = useMemo(() => new Date(expiresUtc).getTime(), [expiresUtc])
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    const tick = () =>
      setRemaining(Math.max(0, expiresAt - (serverAnchor + (Date.now() - deviceAnchor))))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [serverAnchor, deviceAnchor, expiresAt])

  return remaining
}
