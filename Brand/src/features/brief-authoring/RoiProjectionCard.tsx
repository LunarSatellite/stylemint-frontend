import { MoneyDisplay } from '@/components/MoneyDisplay'
import { formatNumber } from '@/lib/formatters'
import type { RoiProjectionSummary } from '@/api/schema'

interface RoiProjectionCardProps {
  roi: RoiProjectionSummary
}

export function RoiProjectionCard({ roi }: RoiProjectionCardProps) {
  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-4">
      <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">ROI Projection</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-[var(--text-muted)]">Est. Reach</p>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {formatNumber(roi.estimatedReachLow)}–{formatNumber(roi.estimatedReachHigh)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Est. Sales</p>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {formatNumber(roi.estimatedSalesLow)}–{formatNumber(roi.estimatedSalesHigh)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Est. Revenue</p>
          <p className="text-sm font-medium text-[var(--primary)]">
            <MoneyDisplay amount={roi.estimatedRevenueLowAmount} currency={roi.estimatedRevenueCurrency ?? 'NPR'} />
            {' – '}
            <MoneyDisplay amount={roi.estimatedRevenueHighAmount} currency={roi.estimatedRevenueCurrency ?? 'NPR'} />
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Reach Cost</p>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            <MoneyDisplay amount={roi.estimatedReachCostAmount} currency={roi.estimatedReachCostCurrency ?? 'NPR'} />
          </p>
        </div>
      </div>
    </div>
  )
}
