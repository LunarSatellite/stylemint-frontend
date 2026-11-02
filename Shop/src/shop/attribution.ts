/**
 * Attribution carried from the share link (contract A1): `?t={taggedProductId|taggedBundleId}&ref={affiliateCode}
 * &utm_source=…` on any entry URL. Stored as `sm_shop_attr` in localStorage for 7 days.
 *
 * - `ref` → `affiliateCode` on every add-to-cart call (the server keeps it on the cart).
 * - `t` is a reel tag id. It only means something for the item the link pointed at, so it is stored with that
 *   target (`p:{productId}` / `b:{bundleId}`) and sent only when that same product / bundle is added
 *   (`reelTagContextId` / `taggedBundleId`). The reel page passes its tag ids directly.
 */

export const ATTR_KEY = 'sm_shop_attr';
export const ATTR_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface Attribution {
  /** Reel tag id from `?t=`. */
  t: string | null;
  /** What `t` belongs to: `p:{productId}` or `b:{bundleId}`; null when it came on another page. */
  tFor: string | null;
  ref: string | null;
  utm: Record<string, string>;
  savedMs: number;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^[A-Za-z0-9_-]{2,40}$/;

export function readAttribution(now = Date.now()): Attribution | null {
  try {
    const raw = localStorage.getItem(ATTR_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as Attribution;
    if (!a || typeof a.savedMs !== 'number' || now - a.savedMs > ATTR_TTL_MS) {
      localStorage.removeItem(ATTR_KEY);
      return null;
    }
    return a;
  } catch {
    return null;
  }
}

export function writeAttribution(a: Attribution) {
  try {
    localStorage.setItem(ATTR_KEY, JSON.stringify(a));
  } catch {
    /* private mode: attribution lasts for this page only */
  }
}

/** The target a page path stands for, e.g. `/shop/p/{id}` → `p:{id}`. */
export function targetOf(pathname: string): string | null {
  const m = /\/(p|b)\/([0-9a-f-]{36})/i.exec(pathname);
  return m ? `${m[1].toLowerCase()}:${m[2].toLowerCase()}` : null;
}

/**
 * Reads `t`, `ref` and `utm_*` from an entry URL and merges them into the stored attribution. A new value
 * replaces the old one (last click wins); a URL without any keeps what was stored. Returns the result.
 */
export function captureAttribution(pathname: string, search: string, now = Date.now()): Attribution | null {
  const q = new URLSearchParams(search);
  const t = q.get('t');
  const ref = q.get('ref');
  const utm: Record<string, string> = {};
  q.forEach((v, k) => {
    if (k.startsWith('utm_') && v) utm[k] = v.slice(0, 100);
  });
  const validT = t && GUID.test(t) ? t.toLowerCase() : null;
  const validRef = ref && CODE.test(ref) ? ref : null;
  const current = readAttribution(now);
  if (!validT && !validRef && Object.keys(utm).length === 0) return current;
  const next: Attribution = {
    t: validT ?? current?.t ?? null,
    tFor: validT ? targetOf(pathname) : (current?.tFor ?? null),
    ref: validRef ?? current?.ref ?? null,
    utm: Object.keys(utm).length ? utm : (current?.utm ?? {}),
    savedMs: now,
  };
  writeAttribution(next);
  return next;
}

/** Fields to merge into `POST /v1/cart/lines` for this product. */
export function productAttribution(productId: string, a: Attribution | null = readAttribution()): { reelTagContextId?: string; affiliateCode?: string } {
  const out: { reelTagContextId?: string; affiliateCode?: string } = {};
  if (a?.ref) out.affiliateCode = a.ref;
  if (a?.t && a.tFor === `p:${productId.toLowerCase()}`) out.reelTagContextId = a.t;
  return out;
}

/** Fields to merge into `POST /v1/cart/bundles` for this bundle. */
export function bundleAttribution(bundleId: string, a: Attribution | null = readAttribution()): { taggedBundleId?: string; affiliateCode?: string } {
  const out: { taggedBundleId?: string; affiliateCode?: string } = {};
  if (a?.ref) out.affiliateCode = a.ref;
  if (a?.t && a.tFor === `b:${bundleId.toLowerCase()}`) out.taggedBundleId = a.t;
  return out;
}
