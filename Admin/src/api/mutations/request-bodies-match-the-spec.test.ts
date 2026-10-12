import { describe, expect, it } from 'vitest';
import bodies from '../request-bodies.json';

/**
 * Every field a mutation sends must exist on the endpoint's request body.
 *
 * This exists because the first version of `useKycDecide` was written
 * from the prose brief rather than the contract, and sent `reasonCode`
 * and `note` where `DecideKycVm` wants `decisionReasonCode` and
 * `decisionNote`. ASP.NET model binding ignores unknown properties, so
 * there is no error anywhere: the request succeeds, the decision is
 * recorded, and the reviewer's stated reason is silently dropped. It
 * also sent a `rowVersion` the endpoint does not accept, which made
 * the client look as though it carried concurrency protection that
 * nothing on the wire actually had.
 *
 * Nothing else would have caught either one. The types are hand-written,
 * the call compiles, and a running server answers 200.
 */

/**
 * `request-bodies.json` is written by `npm run codegen` from the
 * backend's spec and committed, next to the generated types.
 *
 * Reading the backend repository directly worked here and would have
 * failed in CI, which checks out only this one — and a contract guard
 * that cannot find its contract passes by doing nothing, which is the
 * worst way for it to fail. The first version of this file did exactly
 * that.
 */
const SPEC: Record<string, string[]> = bodies;

/** The mutations, and the literal body each one posts. */
const SENDS: { file: string; method: 'post' | 'put' | 'delete'; path: string; keys: string[] }[] = [
  {
    file: 'useKycDecide.ts',
    method: 'post',
    path: '/v1/admin/kyc/{kycItemId}/decide',
    keys: ['decision', 'decisionReasonCode', 'decisionNote'],
  },
  {
    file: 'useModerationDecide.ts',
    method: 'post',
    path: '/v1/admin/moderation/{moderationItemId}/decide',
    keys: ['action', 'decisionNote'],
  },
  {
    file: 'useAudioTrackActions.ts',
    method: 'post',
    path: '/v1/admin/audio/tracks/{trackId}/hide',
    keys: ['reason'],
  },
  {
    file: 'useCourierActions.ts',
    method: 'post',
    path: '/v1/admin/couriers/{courierProfileId}/suspend',
    keys: ['reason'],
  },
  {
    file: 'useSocialFeedActions.ts',
    method: 'post',
    path: '/v1/admin/social-feed/reports/{reportId}/resolve',
    keys: ['reason'],
  },
  {
    file: 'useSocialFeedActions.ts',
    method: 'post',
    path: '/v1/admin/social-feed/posts/{postId}/hide',
    keys: ['reason'],
  },
  {
    file: 'useSocialFeedActions.ts',
    method: 'post',
    path: '/v1/admin/social-feed/posts/{postId}/remove',
    keys: ['reason'],
  },
  {
    file: 'useRecipeActions.ts',
    method: 'post',
    path: '/v1/admin/recipes/{id}/hide',
    keys: ['reason'],
  },
];

function bodyPropertiesOf(path: string, method: string): string[] {
  const key = `${method.toUpperCase()} ${path}`;
  const properties = SPEC[key];
  expect(properties, `${key} has no JSON request body recorded from the spec`).toBeTruthy();
  return properties ?? [];
}

describe('what a mutation sends is what the endpoint accepts', () => {
  it('reads a contract with the admin endpoints in it', () => {
    // Non-vacuity: an empty or missing artifact would otherwise let
    // every assertion below pass by having nothing to check.
    const admin = Object.keys(SPEC).filter((k) => k.includes(' /v1/admin'));
    expect(admin.length).toBeGreaterThan(20);
  });

  for (const { file, method, path, keys } of SENDS) {
    it(`${file} sends only fields ${path} accepts`, () => {
      const accepted = bodyPropertiesOf(path, method);
      const unknown = keys.filter((k) => !accepted.includes(k));
      expect(
        unknown,
        `${file} sends ${unknown.join(', ')}, which ${path} will ignore without complaining. It accepts: ${accepted.join(', ')}`,
      ).toEqual([]);
    });
  }

  it('would have caught the bug it was written for', () => {
    /**
     * The exact shape of the original mistake, asserted against the
     * real spec so this cannot pass by the check having gone inert.
     */
    const accepted = bodyPropertiesOf('/v1/admin/kyc/{kycItemId}/decide', 'post');
    expect(accepted).toContain('decisionReasonCode');
    expect(accepted).not.toContain('reasonCode');
    expect(accepted).not.toContain('rowVersion');
  });
});
