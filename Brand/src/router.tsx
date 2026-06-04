import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/layouts/AppShell'
import { RequireAuth, RequireVendorRole, RequireAdminRole } from '@/auth/guards'

const LoginPage            = lazy(() => import('@/pages/LoginPage'))
const BriefListPage        = lazy(() => import('@/pages/BriefListPage'))
const BriefCreatePage      = lazy(() => import('@/pages/BriefCreatePage'))
const BriefEditorPage      = lazy(() => import('@/pages/BriefEditorPage'))
const DashboardPage        = lazy(() => import('@/pages/DashboardPage'))
const AnalyticsPage        = lazy(() => import('@/pages/AnalyticsPage'))
const ProductAnalyticsPage = lazy(() => import('@/pages/ProductAnalyticsPage'))
const CreatorAnalyticsPage = lazy(() => import('@/pages/CreatorAnalyticsPage'))
const ActivityPage         = lazy(() => import('@/pages/ActivityPage'))
const ProductsPage         = lazy(() => import('@/pages/ProductsPage'))
const PartnershipsPage     = lazy(() => import('@/pages/PartnershipsPage'))
const MatchesPage          = lazy(() => import('@/pages/MatchesPage'))
const SubOrdersPage        = lazy(() => import('@/pages/SubOrdersPage'))
const RecipesPage          = lazy(() => import('@/pages/RecipesPage'))
const InquiriesPage        = lazy(() => import('@/pages/InquiriesPage'))
const GoalTemplatesPage    = lazy(() => import('@/pages/GoalTemplatesPage'))
const VendorPolicyPage     = lazy(() => import('@/pages/VendorPolicyPage'))
const NotFoundPage         = lazy(() => import('@/pages/NotFoundPage'))

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },

      {
        path: '/briefs',
        element: <RequireVendorRole><BriefListPage /></RequireVendorRole>,
      },
      {
        path: '/briefs/new',
        element: <RequireVendorRole><BriefCreatePage /></RequireVendorRole>,
      },
      {
        path: '/briefs/:id',
        element: <RequireVendorRole><BriefEditorPage /></RequireVendorRole>,
      },
      {
        path: '/dashboard',
        element: <RequireVendorRole><DashboardPage /></RequireVendorRole>,
      },
      {
        path: '/analytics',
        element: <RequireVendorRole><AnalyticsPage /></RequireVendorRole>,
      },
      {
        path: '/analytics/products/:productId',
        element: <RequireVendorRole><ProductAnalyticsPage /></RequireVendorRole>,
      },
      {
        path: '/analytics/partnerships/:pid',
        element: <RequireVendorRole><CreatorAnalyticsPage /></RequireVendorRole>,
      },
      {
        path: '/activity',
        element: <RequireVendorRole><ActivityPage /></RequireVendorRole>,
      },
      {
        path: '/products',
        element: <RequireVendorRole><ProductsPage /></RequireVendorRole>,
      },
      {
        path: '/partnerships',
        element: <RequireVendorRole><PartnershipsPage /></RequireVendorRole>,
      },
      {
        path: '/matches',
        element: <RequireVendorRole><MatchesPage /></RequireVendorRole>,
      },
      {
        path: '/sub-orders',
        element: <RequireVendorRole><SubOrdersPage /></RequireVendorRole>,
      },
      {
        path: '/recipes',
        element: <RequireVendorRole><RecipesPage /></RequireVendorRole>,
      },
      {
        path: '/inquiries',
        element: <RequireVendorRole><InquiriesPage /></RequireVendorRole>,
      },
      {
        path: '/admin/goal-templates',
        element: <RequireAdminRole><GoalTemplatesPage /></RequireAdminRole>,
      },
      {
        path: '/admin/vendor-policy/:vendorId',
        element: <RequireAdminRole><VendorPolicyPage /></RequireAdminRole>,
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
