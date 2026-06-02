import { Suspense } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { RecipesTab } from '@/features/recipes/RecipesTab'

export default function RecipesPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="animate-pulse h-64 rounded-xl bg-bg-card" />}>
        <RecipesTab />
      </Suspense>
    </ErrorBoundary>
  )
}
