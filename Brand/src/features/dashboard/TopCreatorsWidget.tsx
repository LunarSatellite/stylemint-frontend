import { MoneyDisplay } from '@/components/MoneyDisplay'
import { formatPercent } from '@/lib/formatters'
import type { CreatorContributionRow } from '@/api/schema'

interface TopCreatorsWidgetProps {
  rows: CreatorContributionRow[]
}

export function TopCreatorsWidget({ rows }: TopCreatorsWidgetProps) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Top Creators</p>
      {rows.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">No data yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.creatorAccountId} className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                  {row.creatorAccountId.slice(0, 8)}…
                </p>
                <p className="text-xs text-[var(--text-muted)]">{row.reelsInWindow} reels</p>
              </div>
              <div className="text-right">
                <MoneyDisplay
                  amount={row.attributedRevenueAmount}
                  currency={row.attributedRevenueCurrency ?? 'NPR'}
                  className="text-xs font-medium text-[var(--text-primary)]"
                />
                <p className="text-xs text-[var(--text-muted)]">
                  ROI {formatPercent(row.roiRatio)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
