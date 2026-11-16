import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// Loads pwa/sw.js in a sandbox and checks which requests its fetch handler takes over.
function loadSw() {
  const listeners: Record<string, (e: unknown) => void> = {};
  const self = {
    location: { origin: 'https://stylemint.voyageritnepal.com' },
    __SHOP_PRECACHE__: ['/shop/'],
    addEventListener: (t: string, fn: (e: unknown) => void) => (listeners[t] = fn),
  };
  const src = readFileSync(resolve(process.cwd(), 'pwa/sw.js'), 'utf8');
  runInNewContext(src, { self, URL, caches: { open: () => new Promise(() => undefined) }, fetch: vi.fn(), Response });
  return (url: string, destination = 'image') => {
    const respondWith = vi.fn();
    listeners.fetch({ request: { method: 'GET', url, mode: 'no-cors', destination }, respondWith });
    return respondWith;
  };
}

describe('shop service worker', () => {
  it('does not intercept cross-origin R2 product images', () => {
    const dispatch = loadSw();
    expect(dispatch('https://pub-c2e6e00670c147b7b4e097fa99043ddf.r2.dev/vendor-products/a.jpg')).not.toHaveBeenCalled();
  });

  it('still handles same-origin images', () => {
    const dispatch = loadSw();
    expect(dispatch('https://stylemint.voyageritnepal.com/shop/icons/icon-192.png')).toHaveBeenCalled();
  });
});
