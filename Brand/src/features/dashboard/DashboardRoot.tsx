import { useState } from 'react'
import { useDashboard } from '@/api/queries/useDashboard'
import { useAuth } from '@/auth/store'
import { ErrorBoundary, WidgetErrorFallback } from '@/components/ErrorBoundary'
import { TopCreatorsWidget } from './TopCreatorsWidget'
import { ReachWidget } from './ReachWidget'
import { FormatLearningsWidget } from './FormatLearningsWidget'
import { BenchmarkWidget } from './BenchmarkWidget'
import { SuggestedCreatorsWidget } from './SuggestedCreatorsWidget'
import { RecipePerformanceWidget } from './RecipePerformanceWidget'

const PERIODS = [
  { label: '30d', value: 30 },
  { label: '60d', value: 60 },
  { label: '90d', value: 90 },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardRoot() {
  const [windowDays, setWindowDays] = useState(30)
  const { data, isPending, isError } = useDashboard(windowDays)
  const claims = useAuth((s) => s.claims)

  const handle = claims?.email.split('@')[0] ?? 'Vendor'

  if (isPending) return <DashboardSkeleton />
  if (isError) return (
    <div className="flex h-full items-center justify-center p-6">
      <p className="text-sm text-[var(--text-muted)]">Dashboard failed to load.</p>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto">
      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden px-6 pb-8 pt-7"
        style={{ background: 'var(--bg-secondary)' }}
      >
        {/* Decorative glow orbs */}
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full"
          style={{ background: 'radial-gradient(circle, var(--glow-primary) 0%, transparent 65%)' }}
        />
        <div
          className="pointer-events-none absolute left-1/3 -bottom-10 h-40 w-64 rounded-full"
          style={{ background: 'radial-gradient(circle, var(--glow-primary) 0%, transparent 70%)', opacity: 0.4 }}
        />

        {/* Bottom fade into page bg */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
          style={{ background: 'linear-gradient(to bottom, transparent, var(--bg-primary))' }}
        />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              {getGreeting()}
            </p>
            <h1 className="mt-1 text-[1.75rem] font-bold leading-tight text-[var(--text-primary)]">
              {handle}
            </h1>
            <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
              Performance snapshot · last {windowDays} days
            </p>
          </div>

          {/* Period selector */}
          <div
            className="flex self-start gap-1 rounded-xl p-1 sm:self-auto"
            style={{
              background: 'var(--surface-3)',
              border: '1px solid var(--surface-border)',
            }}
          >
            {PERIODS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setWindowDays(value)}
                className={
                  windowDays === value
                    ? 'rounded-lg px-4 py-1.5 text-xs font-semibold transition-all bg-[var(--primary)] text-[var(--bg-primary)]'
                    : 'rounded-lg px-4 py-1.5 text-xs font-medium transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Widget grid ─────────────────────────────────────────────────── */}
      <div className="grid gap-4 p-6 lg:grid-cols-2 xl:grid-cols-3">
        <ErrorBoundary fallback={<WidgetErrorFallback label="Top Creators" />}>
          <div className="xl:col-span-2">
            <TopCreatorsWidget rows={data.topCreatorsByAttributedSales ?? []} />
          </div>
        </ErrorBoundary>

        <ErrorBoundary fallback={<WidgetErrorFallback label="Reach" />}>
          {data.reach ? <ReachWidget reach={data.reach} /> : null}
        </ErrorBoundary>

        <ErrorBoundary fallback={<WidgetErrorFallback label="Suggested Creators" />}>
          <SuggestedCreatorsWidget rows={data.suggestedCreators ?? []} />
        </ErrorBoundary>

        <ErrorBoundary fallback={<WidgetErrorFallback label="Format Learnings" />}>
          <FormatLearningsWidget rows={data.formatLearnings ?? []} />
        </ErrorBoundary>

        {data.benchmark !== null && (
          <ErrorBoundary fallback={<WidgetErrorFallback label="Benchmark" />}>
            <BenchmarkWidget benchmark={data.benchmark} />
          </ErrorBoundary>
        )}

        <ErrorBoundary fallback={<WidgetErrorFallback label="Recipe Performance" />}>
          <RecipePerformanceWidget rows={data.byRecipe ?? []} />
        </ErrorBoundary>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="h-full overflow-y-auto" aria-busy="true" aria-label="Loading dashboard">
      <div className="h-36 animate-pulse bg-[var(--bg-secondary)]" />
      <div className="grid gap-4 p-6 lg:grid-cols-2 xl:grid-cols-3">
        <div className="h-52 animate-pulse rounded-xl bg-[var(--surface-2)] xl:col-span-2" />
        <div className="h-52 animate-pulse rounded-xl bg-[var(--surface-2)]" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-[var(--surface-2)]" />
        ))}
      </div>
    </div>
  )
}
