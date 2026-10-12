import { describe, expect, it } from 'vitest';
import { isExpiring, parseClaims } from './parseClaims';

/**
 * These claims decide what the console offers. They are read from a
 * token nobody here verified, so the tests that matter are the ones
 * about not trusting it: malformed input must produce `null` rather
 * than a half-built object that code downstream treats as a signed-in
 * operator.
 */

const b64url = (o: unknown) =>
  btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const token = (payload: unknown) => `${b64url({ alg: 'none' })}.${b64url(payload)}.sig`;

const soon = Math.floor(Date.now() / 1000) + 3600;

describe('parseClaims', () => {
  it('reads an ordinary token', () => {
    const claims = parseClaims(
      token({ sub: 'a1', jti: 's1', email: 'ops@example.com', role: ['SuperAdmin'], exp: soon }),
    );
    expect(claims).toMatchObject({ sub: 'a1', jti: 's1', roles: ['SuperAdmin'] });
  });

  it('treats a single role string as one role, not a list of letters', () => {
    /**
     * .NET emits one role as a string and several as an array from the
     * same claim. Spreading the string gives `['S','u','p',…]`, every
     * role check fails, and the operator sees an empty sidebar.
     */
    expect(parseClaims(token({ role: 'KycReviewer', exp: soon }))?.roles).toEqual(['KycReviewer']);
  });

  it('accepts either claim name', () => {
    expect(parseClaims(token({ roles: ['ContentMod'], exp: soon }))?.roles).toEqual(['ContentMod']);
  });

  it('returns null rather than a partial object for anything unreadable', () => {
    for (const bad of [null, undefined, '', 'not-a-jwt', 'a.b', `${b64url({})}.%%%.c`]) {
      expect(parseClaims(bad as string | null), String(bad)).toBeNull();
    }
  });

  it('returns null when there is no expiry', () => {
    /** Without `exp` the session never looks stale and never refreshes. */
    expect(parseClaims(token({ sub: 'a1', role: 'SuperAdmin' }))).toBeNull();
  });

  it('survives a payload that is valid base64 but not an object', () => {
    expect(parseClaims(`${b64url({ alg: 'none' })}.${b64url('a string')}.sig`)).toBeNull();
  });

  it('has no roles when the claim is missing', () => {
    expect(parseClaims(token({ sub: 'a1', exp: soon }))?.roles).toEqual([]);
  });
});

describe('isExpiring', () => {
  it('is true inside the refresh window and false outside it', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isExpiring({ sub: '', jti: '', roles: [], exp: now + 30 })).toBe(true);
    expect(isExpiring({ sub: '', jti: '', roles: [], exp: now + 600 })).toBe(false);
  });

  it('treats no claims as expiring, so the caller refreshes rather than assumes', () => {
    expect(isExpiring(null)).toBe(true);
  });
});
