import { faker } from '@faker-js/faker'
import type { VendorDashboardSnapshot } from '@/api/schema'

export const buildDashboard = (overrides: Partial<VendorDashboardSnapshot> = {}): VendorDashboardSnapshot => ({
  vendorProfileId:             faker.string.uuid(),
  windowStartUtc:              '2026-05-01',
  windowEndExclusiveUtc:       '2026-06-01',
  topCreatorsByAttributedSales: [],
  reach: {
    totalImpressions:       faker.number.int({ min: 1000, max: 50000 }),
    uniqueAudience:         faker.number.int({ min: 500, max: 20000 }),
    topRegions:             ['Kathmandu', 'Pokhara'],
    underperformingRegions: [],
    audienceGrowthRate:     faker.number.float({ min: 0, max: 0.5 }),
  },
  formatLearnings: [],
  benchmark:       null,
  suggestedCreators: [],
  byRecipe:          [],
  ...overrides,
})
