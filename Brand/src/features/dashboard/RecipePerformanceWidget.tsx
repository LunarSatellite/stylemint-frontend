import { MoneyDisplay } from '@/components/MoneyDisplay'
import type { RecipePerformanceRow } from '@/api/schema'

interface RecipePerformanceWidgetProps {
  rows: RecipePerformanceRow[]
}

export function RecipePerformanceWidget({ rows }: RecipePerformanceWidgetProps) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Recipe Performance</p>
      {rows.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">No recipe data yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={`${row.recipeId}-${row.recipeVersion}`} className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                  Recipe v{row.recipeVersion}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {row.citingCreatorCount} creators · {row.citedReelCount} reels
                </p>
              </div>
              <MoneyDisplay
                amount={row.attributedRevenueAmount}
                currency={row.attributedRevenueCurrency ?? 'NPR'}
                className="text-xs font-medium text-[var(--text-primary)]"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
