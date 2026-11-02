import { useSyncExternalStore } from 'react';
import type { AddBundleBody, AddLineBody } from '../api/cart';
import { cartApi } from '../api/cart';
import { ApiError, messageOf } from '../api/client';
import { newIdempotencyKey } from '../lib/id';

/**
 * Guest cart (contract A4): the add-call payloads themselves, in localStorage, each with its own Idempotency-Key.
 * After sign-in they are replayed to `POST /v1/cart/lines` / `POST /v1/cart/bundles` (adding to whatever the
 * account already has); a replayed item is removed, so a retried replay never adds twice.
 */

export const GUEST_CART_KEY = 'sm_shop_cart';

export type GuestItem =
  | { kind: 'line'; key: string; body: AddLineBody; addedMs: number }
  | { kind: 'bundle'; key: string; body: AddBundleBody; title: string | null; addedMs: number };

let items: GuestItem[] = load();
const listeners = new Set<() => void>();

function load(): GuestItem[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as GuestItem[]).filter((i) => i && (i.kind === 'line' || i.kind === 'bundle')) : [];
  } catch {
    return [];
  }
}

function save(next: GuestItem[]) {
  items = next;
  try {
    if (next.length) localStorage.setItem(GUEST_CART_KEY, JSON.stringify(next));
    else localStorage.removeItem(GUEST_CART_KEY);
  } catch {
    /* kept in memory */
  }
  listeners.forEach((l) => l());
}

export const guestCart = {
  items: () => items,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  count: () => items.reduce((n, i) => n + i.body.quantity, 0),

  addLine(body: AddLineBody) {
    const same = items.find(
      (i): i is Extract<GuestItem, { kind: 'line' }> =>
        i.kind === 'line' && i.body.productId === body.productId && i.body.productVariantId === body.productVariantId,
    );
    if (same) {
      const merged: GuestItem = {
        ...same,
        key: newIdempotencyKey(),
        body: { ...same.body, ...body, quantity: Math.min(99, same.body.quantity + body.quantity) },
      };
      save(items.map((i) => (i === same ? merged : i)));
    } else {
      save([...items, { kind: 'line', key: newIdempotencyKey(), body, addedMs: Date.now() }]);
    }
  },

  addBundle(body: AddBundleBody, title: string | null) {
    save([...items, { kind: 'bundle', key: newIdempotencyKey(), body, title, addedMs: Date.now() }]);
  },

  setQuantity(key: string, quantity: number) {
    save(
      items.map((i) =>
        i.key === key ? ({ ...i, key: newIdempotencyKey(), body: { ...i.body, quantity: Math.max(1, Math.min(99, quantity)) } } as GuestItem) : i,
      ),
    );
  },

  remove(key: string) {
    save(items.filter((i) => i.key !== key));
  },

  clear() {
    save([]);
  },

  /** Merges items restored from a cart hand-off (another browser on this phone). */
  merge(lines: AddLineBody[], bundles: AddBundleBody[]) {
    for (const l of lines) if (l?.productId && l.quantity > 0) guestCart.addLine(l);
    for (const b of bundles) if (b?.bundleId) guestCart.addBundle(b, null);
  },

  /** Tests only. */
  __reload() {
    items = load();
    listeners.forEach((l) => l());
  },
};

export function useGuestCart(): GuestItem[] {
  return useSyncExternalStore(guestCart.subscribe, guestCart.items, guestCart.items);
}

export interface ReplayResult {
  added: number;
  failed: { key: string; message: string }[];
}

/**
 * Sends every guest item to the signed-in cart. A refused item (out of stock, bundle changed…) is dropped
 * with its reason; an offline / server failure keeps it for the next try.
 */
export async function replayGuestCart(): Promise<ReplayResult> {
  const result: ReplayResult = { added: 0, failed: [] };
  for (const item of [...items]) {
    try {
      if (item.kind === 'line') await cartApi.addLine(item.body, item.key);
      else await cartApi.addBundle(item.body, item.key);
      result.added++;
      guestCart.remove(item.key);
    } catch (e) {
      const transient = e instanceof ApiError && (e.isOffline || e.status >= 500 || e.status === 429 || e.status === 401);
      result.failed.push({ key: item.key, message: messageOf(e) });
      if (!transient) guestCart.remove(item.key);
    }
  }
  return result;
}
