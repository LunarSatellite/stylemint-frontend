import { Suspense } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PostPublishReport } from '@/features/post-publish/PostPublishReport'

export default function PostPublishPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="animate-pulse h-64 rounded-xl bg-bg-card" />}>
        <PostPublishReport />
      </Suspense>
    </ErrorBoundary>
  )
}
