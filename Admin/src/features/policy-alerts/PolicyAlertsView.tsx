import { FileText, Loader2, AlertTriangle } from 'lucide-react'
import { PublishPlatformLabel, formatDate } from '@/lib/formatters'
import type { PolicyChangeAlertDto } from '@/api/schema'

interface Props {
  alerts:    PolicyChangeAlertDto[]
  isLoading: boolean
}

const PLATFORM_ICON: Record<string, string> = {
  Instagram: '📸',
  TikTok:    '🎵',
  YouTube:   '▶️',
  Facebook:  '📘',
  StyleMint: '🌿',
}

export function PolicyAlertsView({ alerts, isLoading }: Props) {
  if (isLoading) return (
    <div className="flex items-center justify-center py-16 text-text-muted">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
    </div>
  )

  if (alerts.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-muted">
      <FileText className="h-10 w-10 opacity-20" />
      <span>No policy alerts at this time</span>
    </div>
  )

  return (
    <div className="flex flex-col gap-3 max-w-3xl">
      {alerts.map((alert, i) => {
        const platformName = PublishPlatformLabel[alert.platform ?? 0] ?? `Platform ${alert.platform}`
        return (
          <div key={i} className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/[0.08] text-lg flex-shrink-0">
                {PLATFORM_ICON[platformName] ?? '⚠️'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px] font-semibold text-text-primary">{platformName}</span>
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-[11px] text-text-muted ml-auto whitespace-nowrap">
                    {alert.detectedUtc ? formatDate(alert.detectedUtc) : '—'}
                  </span>
                </div>
                {alert.changeSummary && (
                  <p className="text-[13px] text-text-secondary mb-2">{alert.changeSummary}</p>
                )}
                {alert.advisoryAction && (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                    <p className="text-[11px] text-text-muted uppercase tracking-wide mb-0.5">Recommended action</p>
                    <p className="text-[13px] text-text-secondary">{alert.advisoryAction}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
