import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell, AppShellSkeleton } from '@/layouts/AppShell'

const LoginPage              = lazy(() => import('@/pages/LoginPage'))
const ReelStudioPage         = lazy(() => import('@/pages/ReelStudioPage'))
const StoryArcsPage          = lazy(() => import('@/pages/StoryArcsPage'))
const StoryArcDetailPage     = lazy(() => import('@/pages/StoryArcDetailPage'))
const PostPublishPage        = lazy(() => import('@/pages/PostPublishPage'))
const RecipesPage            = lazy(() => import('@/pages/RecipesPage'))
const AnalyticsDashboardPage = lazy(() => import('@/pages/AnalyticsDashboardPage'))
const AnalyticsReportPage    = lazy(() => import('@/pages/AnalyticsReportPage'))
const ReelAnalyticsPage      = lazy(() => import('@/pages/ReelAnalyticsPage'))
const ActivityPage           = lazy(() => import('@/pages/ActivityPage'))
const NotFoundPage           = lazy(() => import('@/pages/NotFoundPage'))

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={null}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    element: (
      <Suspense fallback={<AppShellSkeleton />}>
        <AppShell />
      </Suspense>
    ),
    children: [
      { index: true, element: <Navigate to="/analytics" replace /> },
      { path: '/studio/:draftId',         element: <ReelStudioPage /> },
      { path: '/story-arcs',              element: <StoryArcsPage /> },
      { path: '/story-arcs/:id',          element: <StoryArcDetailPage /> },
      { path: '/reels/:reelId/report',    element: <PostPublishPage /> },
      { path: '/recipes',                 element: <RecipesPage /> },
      { path: '/analytics',               element: <AnalyticsDashboardPage /> },
      { path: '/analytics/report',        element: <AnalyticsReportPage /> },
      { path: '/analytics/reels/:reelId', element: <ReelAnalyticsPage /> },
      { path: '/activity',                element: <ActivityPage /> },
      { path: '*',                        element: <NotFoundPage /> },
    ],
  },
])
