import { faker } from '@faker-js/faker'
import { VendorActivityKind } from '@/lib/enums'
import type { VendorActivityEntryDto } from '@/api/schema'

export const buildActivity = (overrides: Partial<VendorActivityEntryDto> = {}): VendorActivityEntryDto => ({
  id:              faker.string.uuid(),
  vendorAccountId: faker.string.uuid(),
  kind:            VendorActivityKind.OrderReceived,
  headline:        faker.commerce.productName() + ' order received',
  body:            faker.lorem.sentence(),
  actionUrl:       null,
  occurredUtc:     new Date().toISOString(),
  createdUtc:      new Date().toISOString(),
  ...overrides,
})
