import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { installSession } from '@/auth/session';
import { mockFetch, signInAs, type Captured } from '@/test/utils';
import { passwordApi } from './adminAuth';
import { adminsApi, meApi } from './admins';
import { contentApi, popularSearchesApi } from './catalog';
import { couriersApi } from './couriers';
import { kycApi } from './kyc';
import { courierPayoutsApi, payoutsApi } from './money';
import { moderationApi } from './moderation';
import { ordersApi, paymentsApi } from './orders';
import { configApi, flagsApi } from './platform';
import { deliveryApi } from './delivery';
import { tryOnApi } from './tryOn';
import bodies from './request-bodies.json';

/**
 * Every field a write sends must exist on the endpoint's request body.
 *
 * ASP.NET ignores unknown JSON properties: send `reasonCode` where the API wants `decisionReasonCode` and the call
 * returns 200 while the reviewer's reason is silently dropped. Nothing else catches that - the types are written by
 * hand and a live server answers 200 - so this runs the REAL client functions against a recording fetch and compares
 * each body with the field names frozen from the backend's OpenAPI spec (`request-bodies.json`, committed so CI can
 * read it). Endpoints newer than that spec are skipped, and the test says which.
 */
const SPEC: Record<string, string[]> = bodies;
const ID = '00000000-0000-4000-8000-000000000001';

function templateFor(req: Captured): string | undefined {
  const candidates = Object.keys(SPEC).filter((k) => k.startsWith(`${req.method} `));
  return candidates.find((k) => {
    const pattern = k.slice(req.method.length + 1).replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+');
    return new RegExp(`^${pattern}$`).test(req.path);
  });
}

const WRITES: [string, () => Promise<unknown>][] = [
  ['kyc assign', () => kycApi.assign(ID)],
  ['kyc decide', () => kycApi.decide(ID, { decision: 2, decisionReasonCode: 'DOCS_UNCLEAR', decisionNote: 'blurry' })],
  ['moderation assign', () => moderationApi.assign(ID, ID)],
  ['moderation decide', () => moderationApi.decide(ID, 2, 'note')],
  ['courier kyc complete', () => couriersApi.completeKyc(ID, { approved: true, governmentIdLast4: '1234', selfieMatchRef: ID, rejectionReason: null })],
  ['courier suspend', () => couriersApi.suspend(ID, 'reason')],
  ['courier escrow draw', () => couriersApi.escrowDraw(ID, { amount: 10, currency: 'NPR', packageId: null, note: 'claim' })],
  ['courier escrow deposit', () => couriersApi.escrowDeposit(ID, { amount: 10, currency: 'NPR', note: null })],
  ['refund', () => paymentsApi.refund(ID, { amount: 10, currency: 'NPR', reasonTag: 'goodwill', reason: 'sorry' })],
  ['payout hold', () => payoutsApi.hold(ID, 'checking')],
  ['payout release', () => payoutsApi.release(ID, 'checked')],
  ['payout force paid', () => payoutsApi.forcePaid(ID, 'paid by bank')],
  ['payout force failed', () => payoutsApi.forceFailed(ID, 'bounced')],
  ['payout mark paid', () => payoutsApi.markPaid(ID, 'NIMB-1', 'sent from ops')],
  ['payout mark failed', () => payoutsApi.markFailed(ID, 'account closed')],
  ['courier cash remittance', () => courierPayoutsApi.recordCashRemittance(ID, { amount: 2500, reference: 'slip 4411', note: null })],
  ['courier fare release', () => courierPayoutsApi.releaseEarning(ID, 'checked')],
  ['courier fare void', () => courierPayoutsApi.voidEarning(ID, 'not delivered')],
  ['order archive', () => ordersApi.archive({ orderIds: [ID], reason: 'test order', dryRun: true })],
  ['flag upsert', () => flagsApi.upsert('k', true, 'd')],
  ['flag override', () => flagsApi.setOverride('k', { roleKind: 'Vendor', accountId: null, enabled: true })],
  ['config set', () => configApi.set('k', '1', null)],
  ['totp confirm', () => meApi.confirmTotp('123456')],
  ['totp enroll', () => meApi.enrollTotp('label')],
  ['popular search create', () => popularSearchesApi.create({ label: 'l', query: 'q', displayOrder: 0, regionCode: null })],
  ['post hide', () => contentApi.hidePost(ID, 'r')],
  ['recipe hide', () => contentApi.hideRecipe(ID, 'r')],
  ['replan', () => deliveryApi.replan(ID, 3, null)],
  ['admin revoke sessions', () => adminsApi.revokeAllSessions(ID, 'left the company')],
  ['admin invite', () => adminsApi.invite({ email: 'a@b.test', displayName: 'A', roles: [2] })],
  ['admin password reset request', () => passwordApi.requestReset('a@b.test')],
  ['try-on settings', () => tryOnApi.saveSettings({ enabled: true, freeForEveryone: false, freeTrialDays: 3, disclaimer: 'd' })],
  ['try-on plan create', () => tryOnApi.createPlan({ name: 'Monthly', description: null, priceAmount: 299, currency: 'NPR', durationDays: 30, isActive: true, sortOrder: 0 })],
  ['try-on plan update', () => tryOnApi.updatePlan(ID, { name: 'Monthly', description: null, priceAmount: 299, currency: 'NPR', durationDays: 30, isActive: true, sortOrder: 0 })],
  ['try-on grant', () => tryOnApi.grant({ accountId: ID, days: 30, note: null })],
  ['try-on revoke', () => tryOnApi.revoke(ID, 'abuse')],
  ['admin password set', () => passwordApi.set('token', 'a good password 1')],
];

describe('what a write sends is what the endpoint accepts', () => {
  let calls: Captured[] = [];
  beforeAll(() => {
    installSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reads a contract with the admin endpoints in it', () => {
    expect(Object.keys(SPEC).filter((k) => k.includes(' /v1/admin')).length).toBeGreaterThan(20);
  });

  for (const [name, call] of WRITES) {
    it(`${name} sends only fields the endpoint accepts`, async () => {
      signInAs();
      calls = mockFetch(() => ({ body: {} })).calls;
      await call();
      const req = calls[0]!;
      const template = templateFor(req);
      if (!template) {
        // Newer than the frozen spec: recorded so the gap is visible, not silently passed.
        console.info(`[contract] ${req.method} ${req.path} is not in request-bodies.json yet`);
        return;
      }
      const sent = req.body && typeof req.body === 'object' ? Object.keys(req.body as object) : [];
      const accepted = SPEC[template]!;
      const unknown = sent.filter((k) => !accepted.includes(k));
      expect(unknown, `${template} would silently ignore ${unknown.join(', ')}; it accepts ${accepted.join(', ')}`).toEqual([]);
    });
  }

  it('would have caught the bug it exists for', () => {
    const accepted = SPEC['POST /v1/admin/kyc/{kycItemId}/decide']!;
    expect(accepted).toContain('decisionReasonCode');
    expect(accepted).not.toContain('reasonCode');
  });
});
