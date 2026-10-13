/** Test helpers for the CRM: OmniFlow envelopes and a CRM session route. Test-only. */

export const CRM = '/api/v1/crm';
export const SESSION = 'POST /v1/vendor/crm/session';

export function sessionBody(role = 'Owner', token = 'crm-token-1', lifetimeMs = 15 * 60_000) {
  return {
    accessToken: token,
    expiresUtc: new Date(Date.now() + lifetimeMs).toISOString(),
    tenantId: 'tenant-1',
    role,
    vendorAccountId: 'vendor-1',
    businessName: 'Kathmandu Threads',
  };
}

export function envelope(data: unknown) {
  return { body: { success: true, data, message: 'ok', correlationId: 'c-1' } };
}

export function pagedEnvelope<T>(items: T[], opts: { page?: number; pageSize?: number; total?: number } = {}) {
  const pageSize = opts.pageSize ?? 25;
  const total = opts.total ?? items.length;
  return {
    body: {
      success: true,
      data: items,
      totalCount: total,
      pageNumber: opts.page ?? 1,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      correlationId: 'c-1',
    },
  };
}

/** A synced buyer — with phone/email the backend must never send, to prove the UI drops them. */
export function sellerCustomer(patch: Record<string, unknown> = {}) {
  return {
    contactId: 'c-1',
    buyerAccountId: 'b-1',
    fullName: 'Sita Sharma',
    city: 'Lalitpur',
    firstOrderUtc: '2026-03-02T05:00:00Z',
    lastOrderUtc: '2026-10-01T05:00:00Z',
    orderCount: 7,
    lifetimeValue: 18450,
    currency: 'NPR',
    returnsCount: 1,
    reviewCount: 3,
    averageRating: 4.7,
    questionsCount: 2,
    consent: { push: true, email: false, sms: false, updatedUtc: '2026-09-01T00:00:00Z' },
    canMessage: true,
    erased: false,
    lastActivityUtc: '2026-10-01T05:00:00Z',
    email: 'sita.sharma@example.com',
    phone: '+9779812345678',
    ...patch,
  };
}
