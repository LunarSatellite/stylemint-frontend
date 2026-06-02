import { http, HttpResponse } from 'msw'
import { faker } from '@faker-js/faker'
import type { VendorBrandStudioPolicyDto } from '@/api/schema'

function buildPolicy(overrides: Partial<VendorBrandStudioPolicyDto> = {}): VendorBrandStudioPolicyDto {
  return {
    id:                      faker.string.uuid(),
    vendorProfileId:         faker.string.uuid(),
    monthlyLlmCallQuota:     100,
    commissionCeilingPercent: 0.30,
    defaultCurrencyCode:     'NPR',
    createdUtc:              new Date().toISOString(),
    updatedUtc:              new Date().toISOString(),
    rowVersion:              '1',
    ...overrides,
  }
}

export const policyHandlers = [
  http.get('/v1/admin/brand-studio/policies/:vendorProfileId', ({ params }) =>
    HttpResponse.json(buildPolicy({ vendorProfileId: params['vendorProfileId'] as string })),
  ),
  http.patch('/v1/admin/brand-studio/policies/:vendorProfileId', ({ params }) =>
    HttpResponse.json(buildPolicy({ vendorProfileId: params['vendorProfileId'] as string, rowVersion: '2' })),
  ),
]
