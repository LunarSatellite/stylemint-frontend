import { describe, expect, it } from 'vitest';

/**
 * Eight endpoints can demand a fresh identity check. Every call to one
 * must go through `useMutationWithStepUp`.
 *
 * Forgetting is silent in the good case and ugly in the bad one. The
 * server returns `mfa.step_up_required`, a plain `useMutation` has no
 * idea what that means, and the operator sees "Please verify your
 * identity to continue" as a red toast with no way to verify anything.
 * The action simply does not happen, and the only clue is a message
 * that reads like an instruction nobody can follow.
 *
 * It cannot be caught by types — both wrappers return a mutation — and
 * it cannot be caught without a server, which is why it is a source
 * check.
 */

const MUTATIONS = import.meta.glob('/src/api/mutations/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * Path fragments, as they appear in a template literal, for the writes
 * on the step-up list. Taken from the brief and confirmed against
 * `swagger-spec.json`.
 */
const STEP_UP = [
  '/auth/mfa/totp',
  '/roles/',
  '/disable',
  '/enable',
  '/sessions/revoke-all',
  '/mfa',
  '/force-paid',
  '/force-failed',
];

function callsStepUpEndpoint(source: string): string[] {
  const hits: string[] = [];
  // `api.post(...)`, `api.delete(...)` and the URL they are given.
  for (const m of source.matchAll(/api\.(post|put|delete)\(\s*`([^`]+)`/g)) {
    const url = m[2] ?? '';
    const fragment = STEP_UP.find((f) => url.includes(f));
    if (fragment) hits.push(`${m[1]?.toUpperCase()} ${url}`);
  }
  return hits;
}

describe('a sensitive write cannot skip step-up', () => {
  it('is reading the mutation files', () => {
    expect(Object.keys(MUTATIONS).length).toBeGreaterThan(2);
  });

  it('every file touching a step-up endpoint uses the step-up wrapper', () => {
    const offenders: string[] = [];

    for (const [path, source] of Object.entries(MUTATIONS)) {
      if (path.endsWith('.test.ts')) continue;
      const sensitive = callsStepUpEndpoint(source);
      if (!sensitive.length) continue;

      if (!source.includes('useMutationWithStepUp')) {
        offenders.push(`${path} calls ${sensitive.join(', ')} without useMutationWithStepUp`);
      }
      // A plain useMutation in the same file would be the easy way to
      // let one of several writes slip past the wrapper.
      if (/\buseMutation\b(?!WithStepUp)/.test(source)) {
        offenders.push(`${path} also uses a plain useMutation alongside step-up endpoints`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('recognises the shape it is looking for', () => {
    expect(
      callsStepUpEndpoint('await api.delete(`/v1/admin/admins/${id}/mfa`, { params })'),
    ).toHaveLength(1);
    expect(
      callsStepUpEndpoint('await api.post(`/v1/admin/payouts/${id}/force-paid`)'),
    ).toHaveLength(1);
    expect(callsStepUpEndpoint('await api.get(`/v1/admin/admins`)')).toEqual([]);
    expect(callsStepUpEndpoint('await api.post(`/v1/admin/kyc/${id}/decide`)')).toEqual([]);
  });
});
