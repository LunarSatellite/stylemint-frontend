import { faker } from '@faker-js/faker'
import { BrandBriefState, CampaignGoal } from '@/lib/enums'
import type { BrandBriefDto } from '@/api/schema'

export const buildBrief = (overrides: Partial<BrandBriefDto> = {}): BrandBriefDto => ({
  id:              faker.string.uuid(),
  vendorProfileId: faker.string.uuid(),
  title:           faker.commerce.productName(),
  primaryGoal:     CampaignGoal.DriveFirstPurchase,
  version:         1,
  rootBriefId:     faker.string.uuid(),
  parentBriefId:   null,
  state:           BrandBriefState.Draft,
  commissionRange: { minPercent: 0.05, maxPercent: 0.15 },
  boostBudgetAmount:   0,
  boostBudgetCurrency: 'NPR',
  roiProjection:   null,
  body:            null,
  explanationByKey: null,
  lockedUtc:       null,
  createdUtc:      new Date().toISOString(),
  updatedUtc:      new Date().toISOString(),
  rowVersion:      '1',
  ...overrides,
})
