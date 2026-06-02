import { http, HttpResponse } from 'msw'
import { buildKycQueuePage, mockKycItems } from './kycData'
import { buildModerationQueuePage, mockModerationItems } from './moderationData'

// Prefix every handler with the real API base URL so MSW intercepts
// requests regardless of which origin axios is pointing at.
const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export const handlers = [

  // ── KYC queue ──────────────────────────────────────────────────────────────
  http.get(`${BASE}/v1/admin/kyc/queue`, ({ request }) => {
    const url    = new URL(request.url)
    const filter = Object.fromEntries(url.searchParams.entries())
    return HttpResponse.json(buildKycQueuePage(filter))
  }),

  // ── KYC detail ─────────────────────────────────────────────────────────────
  http.get(`${BASE}/v1/admin/kyc/:id`, ({ params }) => {
    const item = mockKycItems.find(i => i.id === params.id)
    if (!item) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json(item)
  }),

  // ── KYC assign ─────────────────────────────────────────────────────────────
  http.post(`${BASE}/v1/admin/kyc/:id/assign`, async ({ params, request }) => {
    const item = mockKycItems.find(i => i.id === params.id)
    if (!item) return new HttpResponse(null, { status: 404 })
    const body = await request.json() as { reviewerAdminId: string }
    const updated = { ...item, state: 2 as const, assignedReviewerId: body.reviewerAdminId }
    const idx = mockKycItems.findIndex(i => i.id === params.id)
    mockKycItems[idx] = updated
    return HttpResponse.json(updated)
  }),

  // ── KYC decide ─────────────────────────────────────────────────────────────
  http.post(`${BASE}/v1/admin/kyc/:id/decide`, async ({ params, request }) => {
    const item = mockKycItems.find(i => i.id === params.id)
    if (!item) return new HttpResponse(null, { status: 404 })
    const body = await request.json() as { decision: 1|2|3; decisionReasonCode?: string; decisionNote?: string }
    const updated = {
      ...item,
      state:              3 as const,
      decision:           body.decision,
      decisionReasonCode: body.decisionReasonCode ?? null,
      decisionNote:       body.decisionNote ?? null,
      decidedUtc:         new Date().toISOString(),
    }
    const idx = mockKycItems.findIndex(i => i.id === params.id)
    mockKycItems[idx] = updated
    return HttpResponse.json(updated)
  }),

  // ── Moderation queue ───────────────────────────────────────────────────────
  http.get(`${BASE}/v1/admin/moderation/queue`, ({ request }) => {
    const url    = new URL(request.url)
    const filter = Object.fromEntries(url.searchParams.entries())
    return HttpResponse.json(buildModerationQueuePage(filter))
  }),

  // ── Moderation detail ──────────────────────────────────────────────────────
  http.get(`${BASE}/v1/admin/moderation/:id`, ({ params }) => {
    const item = mockModerationItems.find(i => i.id === params.id)
    if (!item) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json(item)
  }),

  // ── Moderation assign ──────────────────────────────────────────────────────
  http.post(`${BASE}/v1/admin/moderation/:id/assign`, async ({ params, request }) => {
    const item = mockModerationItems.find(i => i.id === params.id)
    if (!item) return new HttpResponse(null, { status: 404 })
    const body = await request.json() as { reviewerAdminId: string }
    const updated = { ...item, state: 2 as const, assignedReviewerId: body.reviewerAdminId }
    const idx = mockModerationItems.findIndex(i => i.id === params.id)
    mockModerationItems[idx] = updated
    return HttpResponse.json(updated)
  }),

  // ── Moderation decide ──────────────────────────────────────────────────────
  http.post(`${BASE}/v1/admin/moderation/:id/decide`, async ({ params, request }) => {
    const item = mockModerationItems.find(i => i.id === params.id)
    if (!item) return new HttpResponse(null, { status: 404 })
    const body = await request.json() as { action: 1|2|3|4|5|6; decisionNote?: string }
    const updated = {
      ...item,
      state:        3 as const,
      action:       body.action,
      decisionNote: body.decisionNote ?? null,
      decidedUtc:   new Date().toISOString(),
    }
    const idx = mockModerationItems.findIndex(i => i.id === params.id)
    mockModerationItems[idx] = updated
    return HttpResponse.json(updated)
  }),

]
