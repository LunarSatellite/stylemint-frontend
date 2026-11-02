import { beforeEach, describe, expect, it } from 'vitest';
import { ATTR_KEY, ATTR_TTL_MS, bundleAttribution, captureAttribution, productAttribution, readAttribution } from './attribution';

const P = 'aaaaaaaa-0000-4000-8000-000000000001';
const OTHER = 'aaaaaaaa-0000-4000-8000-000000000009';
const B = 'eeeeeeee-0000-4000-8000-000000000001';
const T = 'dddddddd-0000-4000-8000-000000000001';

describe('attribution (?t= & ?ref=)', () => {
  beforeEach(() => localStorage.clear());

  it('stores t, ref and utm_* for 7 days under sm_shop_attr', () => {
    const now = 1_000_000;
    captureAttribution(`/p/${P}`, `?t=${T}&ref=MAYA_01&utm_source=instagram&utm_campaign=dashain`, now);
    const a = readAttribution(now + 1000);
    expect(a).toMatchObject({ t: T, tFor: `p:${P}`, ref: 'MAYA_01', utm: { utm_source: 'instagram', utm_campaign: 'dashain' } });
    expect(localStorage.getItem(ATTR_KEY)).not.toBeNull();
    expect(readAttribution(now + ATTR_TTL_MS + 1)).toBeNull();
    expect(localStorage.getItem(ATTR_KEY)).toBeNull();
  });

  it('keeps stored values when a later URL carries none, and replaces them when it does', () => {
    captureAttribution(`/p/${P}`, `?ref=FIRST`, 1);
    captureAttribution('/cart', '', 2);
    expect(readAttribution(3)?.ref).toBe('FIRST');
    captureAttribution(`/b/${B}`, `?t=${T}&ref=SECOND`, 4);
    expect(readAttribution(5)).toMatchObject({ ref: 'SECOND', t: T, tFor: `b:${B}` });
  });

  it('ignores malformed values', () => {
    captureAttribution(`/p/${P}`, '?t=not-a-guid&ref=<script>', 1);
    expect(readAttribution(2)).toBeNull();
  });

  it('sends the reel tag only for the item it belongs to; the affiliate code for everything', () => {
    captureAttribution(`/p/${P}`, `?t=${T}&ref=MAYA`);
    expect(productAttribution(P)).toEqual({ reelTagContextId: T, affiliateCode: 'MAYA' });
    expect(productAttribution(OTHER)).toEqual({ affiliateCode: 'MAYA' });
    expect(bundleAttribution(B)).toEqual({ affiliateCode: 'MAYA' });

    captureAttribution(`/b/${B}`, `?t=${T}`);
    expect(bundleAttribution(B)).toEqual({ taggedBundleId: T, affiliateCode: 'MAYA' });
    expect(productAttribution(P)).toEqual({ affiliateCode: 'MAYA' });
  });
});
