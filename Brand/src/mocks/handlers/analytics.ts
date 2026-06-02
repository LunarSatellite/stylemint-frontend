import { http, HttpResponse } from 'msw'
import { buildAnalyticsOverview } from '../factories/analytics.factory'

export const analyticsHandlers = [
  http.get('/v1/vendor/analytics/overview', () =>
    HttpResponse.json(buildAnalyticsOverview()),
  ),
  http.get('/v1/vendor/analytics/products', () =>
    HttpResponse.json({ window: { fromUtc: '', toUtc: '', durationDays: 30 }, items: [] }),
  ),
  http.get('/v1/vendor/analytics/creators', () =>
    HttpResponse.json({ window: { fromUtc: '', toUtc: '', durationDays: 30 }, items: [] }),
  ),
  http.get('/v1/vendor/products/:productId/analytics', () =>
    HttpResponse.json({ window: { fromUtc: '', toUtc: '', durationDays: 30 }, header: null, revenue: null, unitsSold: null, revenueTrend: [], topCreators: [], locations: [], reviews: null }),
  ),
  http.get('/v1/vendor/partnerships/:partnershipId/creator-analytics', () =>
    HttpResponse.json({ window: { fromUtc: '', toUtc: '', durationDays: 30 }, header: null, attributedRevenue: null, unitsSold: null, commissionPaid: null, distinctReelCount: null, revenueTrend: [], topProducts: [], topReels: [] }),
  ),
]
