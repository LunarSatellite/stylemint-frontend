import { faker } from '@faker-js/faker'
import type { VendorAnalyticsOverviewDto } from '@/api/schema'

const buildKpiTile = (amount: number) => ({
  current:        { amount, currency: 'NPR' },
  previousPeriod: { amount: amount * 0.85, currency: 'NPR' },
  deltaPercent:   0.15,
})

export const buildAnalyticsOverview = (overrides: Partial<VendorAnalyticsOverviewDto> = {}): VendorAnalyticsOverviewDto => ({
  window: { fromUtc: '2026-05-01T00:00:00Z', toUtc: '2026-06-01T00:00:00Z', durationDays: 30 },
  grossSales:     buildKpiTile(faker.number.float({ min: 10000, max: 500000 })),
  netRevenue:     buildKpiTile(faker.number.float({ min: 8000, max: 400000 })),
  conversionRate: { current: 0.032, previousPeriod: 0.028, deltaPercent: 0.143 },
  totalOrders:    { current: faker.number.int({ min: 50, max: 500 }), previousPeriod: faker.number.int({ min: 40, max: 400 }), deltaPercent: 0.12 },
  revenueTrend:   [],
  topProducts:    [],
  topCreators:    [],
  trafficSources: [],
  ...overrides,
})
