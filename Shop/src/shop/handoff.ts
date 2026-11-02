import type { AddBundleBody, AddLineBody } from '../api/cart';
import { api } from '../api/client';
import { readAttribution, writeAttribution, type Attribution } from './attribution';
import { guestCart } from './guestCart';

/**
 * Cart carry-over across browsers (contract A4): before leaving an in-app browser the shop parks the guest cart
 * and attribution under a one-time token (`POST /v1/public/shop/cart-handoff`, 30 min, ≤ 4 KB); the page reopened
 * in Chrome / Safari with `?restore={token}` reads it back once. No personal data is sent.
 */

export interface HandoffPayload {
  lines: AddLineBody[];
  bundles: AddBundleBody[];
  attr: Pick<Attribution, 't' | 'tFor' | 'ref' | 'utm'> | null;
}

export function handoffPayload(): HandoffPayload {
  const items = guestCart.items();
  const a = readAttribution();
  return {
    lines: items.flatMap((i) => (i.kind === 'line' ? [i.body] : [])),
    bundles: items.flatMap((i) => (i.kind === 'bundle' ? [i.body] : [])),
    attr: a ? { t: a.t, tFor: a.tFor, ref: a.ref, utm: a.utm } : null,
  };
}

/** A token, or null when there is nothing to carry or the endpoint is not deployed (the link still works). */
export async function createHandoff(): Promise<string | null> {
  const payload = handoffPayload();
  if (!payload.lines.length && !payload.bundles.length && !payload.attr) return null;
  try {
    const res = await api.post<{ token: string }>('/v1/public/shop/cart-handoff', payload, { anonymous: true });
    return res?.token ?? null;
  } catch {
    return null;
  }
}

/** Reads a hand-off token into this browser's guest cart. Silent on any failure (expired, used, missing). */
export async function restoreHandoff(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(token)) return false;
  try {
    const data = await api.get<HandoffPayload>(`/v1/public/shop/cart-handoff/${encodeURIComponent(token)}`, undefined, { anonymous: true });
    if (!data) return false;
    guestCart.merge(Array.isArray(data.lines) ? data.lines : [], Array.isArray(data.bundles) ? data.bundles : []);
    if (data.attr && !readAttribution()) writeAttribution({ t: data.attr.t ?? null, tFor: data.attr.tFor ?? null, ref: data.attr.ref ?? null, utm: data.attr.utm ?? {}, savedMs: Date.now() });
    return true;
  } catch {
    return false;
  }
}
