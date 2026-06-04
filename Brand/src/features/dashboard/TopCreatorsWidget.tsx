import { Trophy } from 'lucide-react'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { formatPercent } from '@/lib/formatters'
import type { CreatorContributionRow } from '@/api/schema'

interface TopCreatorsWidgetProps {
  rows: CreatorContributionRow[]
}

export function TopCreatorsWidget({ rows }: TopCreatorsWidgetProps) {
  const maxRevenue = rows.length > 0
    ? Math.max(...rows.map((r) => r.attributedRevenueAmount))
    : 1

  return (
    <div
      className="h-full rounded-xl p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <WidgetHeader icon={<Trophy className="h-3.5 w-3.5 text-[var(--primary)]" />} label="Top Creators">
        {rows.length > 0 && (
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
          >
            {rows.length}
          </span>
        )}
      </WidgetHeader>

      {rows.length === 0 ? (
        <WidgetEmpty label="No creator data yet" />
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => {
            const barWidth = `${(row.attributedRevenueAmount / maxRevenue) * 100}%`
            const initials = row.creatorAccountId.slice(0, 2).toUpperCase()
            const isTop = i === 0

            return (
              <div
                key={row.creatorAccountId}
                className="rounded-lg p-3 transition-colors"
                style={{ background: isTop ? 'var(--surface-2)' : 'transparent' }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-5 shrink-0 text-center text-xs font-bold tabular-nums"
                    style={{ color: isTop ? 'var(--primary)' : 'var(--text-muted)' }}
                  >
                    {i + 1}
                  </span>

                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{
                      background: isTop ? 'var(--primary)' : 'var(--surface-3)',
                      color: isTop ? 'var(--bg-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                        {row.creatorAccountId.slice(0, 10)}…
                      </p>
                      <MoneyDisplay
                        amount={row.attributedRevenueAmount}
                        currency={row.attributedRevenueCurrency ?? 'NPR'}
                        className="shrink-0 text-xs font-bold text-[var(--text-primary)]"
                      />
                    </div>

                    <div className="mt-1.5 flex items-center gap-2">
                      <div
                        className="h-1 flex-1 overflow-hidden rounded-full"
                        style={{ background: 'var(--surface-3)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: barWidth,
                            background: isTop ? 'var(--primary)' : 'var(--text-muted)',
                          }}
                        />
                      </div>
                      <span className="shrink-0 text-xs text-[var(--text-muted)]">
                        {row.reelsInWindow} reels · ROI {formatPercent(row.roiRatio)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function WidgetHeader({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div
        className="flex h-7 w-7 items-center justify-center rounded-lg"
        style={{ background: 'var(--surface-3)' }}
      >
        {icon}
      </div>
      <p className="text-sm font-semibold text-[var(--text-secondary)]">{label}</p>
      {children}
    </div>
  )
}

function WidgetEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-16 items-center justify-center">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  )
}
