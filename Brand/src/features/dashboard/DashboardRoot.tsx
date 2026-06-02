import { useDashboard } from '@/api/queries/useDashboard'
import { ErrorBoundary, WidgetErrorFallback } from '@/components/ErrorBoundary'
import { TopCreatorsWidget } from './TopCreatorsWidget'
import { ReachWidget } from './ReachWidget'
import { FormatLearningsWidget } from './FormatLearningsWidget'
import { BenchmarkWidget } from './BenchmarkWidget'
import { SuggestedCreatorsWidget } from './SuggestedCreatorsWidget'
import { RecipePerformanceWidget } from './RecipePerformanceWidget'

export function DashboardRoot() {
  const { data, isPending, isError } = useDashboard(30)

  if (isPending) return <DashboardSkeleton />
  if (isError)   return <div className="p-6 text-[var(--text-muted)]">Dashboard failed to load.</div>

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="mb-6 text-xl font-semibold text-[var(--text-primary)]">Dashboard</h1>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ErrorBoundary fallback={<WidgetErrorFallback label="Top Creators" />}>
          <TopCreatorsWidget rows={data.topCreatorsByAttributedSales ?? []} />
        </ErrorBoundary>

        <ErrorBoundary fallback={<WidgetErrorFallback label="Reach" />}>
          {data.reach && <ReachWidget reach={data.reach} />}
        </ErrorBoundary>

        <ErrorBoundary fallback={<WidgetErrorFallback label="Format Learnings" />}>
          <FormatLearningsWidget rows={data.formatLearnings ?? []} />
        </ErrorBoundary>

        {/* benchmark === null → hide entirely, never show empty state */}
        {data.benchmark !== null && (
          <ErrorBoundary fallback={<WidgetErrorFallback label="Benchmark" />}>
            <BenchmarkWidget benchmark={data.benchmark} />
          </ErrorBoundary>
        )}

        <ErrorBoundary fallback={<WidgetErrorFallback label="Suggested Creators" />}>
          <SuggestedCreatorsWidget rows={data.suggestedCreators ?? []} />
        </ErrorBoundary>

        <ErrorBoundary fallback={<WidgetErrorFallback label="Recipe Performance" />}>
          <RecipePerformanceWidget rows={data.byRecipe ?? []} />
        </ErrorBoundary>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-4" aria-busy="true" aria-label="Loading dashboard">
      <div className="h-8 w-32 animate-pulse rounded-lg bg-[var(--surface-2)]" />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-[var(--surface-2)]" />
        ))}
      </div>
    </div>
  )
}
