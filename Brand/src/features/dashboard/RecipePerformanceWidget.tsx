import { ChefHat } from 'lucide-react'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import type { RecipePerformanceRow } from '@/api/schema'

interface RecipePerformanceWidgetProps {
  rows: RecipePerformanceRow[]
}

export function RecipePerformanceWidget({ rows }: RecipePerformanceWidgetProps) {
  const maxRevenue = rows.length > 0
    ? Math.max(...rows.map((r) => r.attributedRevenueAmount))
    : 1

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="mb-4 flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: 'var(--surface-3)' }}
        >
          <ChefHat className="h-3.5 w-3.5 text-[var(--primary)]" />
        </div>
        <p className="text-sm font-semibold text-[var(--text-secondary)]">Recipe Performance</p>
      </div>

      {rows.length === 0 ? (
        <WidgetEmpty label="No recipe data yet" />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const barWidth = `${(row.attributedRevenueAmount / maxRevenue) * 100}%`

            return (
              <div key={`${row.recipeId}-${row.recipeVersion}`}>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-md px-2 py-0.5 text-xs font-bold"
                      style={{ background: 'var(--surface-3)', color: 'var(--primary)' }}
                    >
                      v{row.recipeVersion}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {row.citingCreatorCount}c · {row.citedReelCount}r
                    </span>
                  </div>
                  <MoneyDisplay
                    amount={row.attributedRevenueAmount}
                    currency={row.attributedRevenueCurrency ?? 'NPR'}
                    className="text-xs font-bold text-[var(--text-primary)]"
                  />
                </div>

                <div
                  className="h-1.5 overflow-hidden rounded-full"
                  style={{ background: 'var(--surface-3)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: barWidth, background: 'var(--primary)' }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
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
