import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, URL } from 'node:url';
import type { Plugin } from 'vite';

/**
 * Emits `sw.js` at the root of dist/ with the app shell list baked in: index.html, the offline page, the
 * manifest, the icons and every hashed asset of this build. The cache name carries a hash of that list, so a
 * new deploy installs a new cache and the old one is deleted on activate. Nothing from `/v1/*` is cached.
 */
export function serviceWorker(): Plugin {
  return {
    name: 'stylemint-shop-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      const base = '/shop/';
      const assets = Object.keys(bundle)
        .filter((f) => f.startsWith('assets/') && !f.endsWith('.map'))
        .map((f) => base + f);
      const shell = [base, `${base}offline.html`, `${base}manifest.webmanifest`, `${base}icons/icon-192.png`, `${base}icons/icon-512.png`];
      const precache = [...shell, ...assets].sort();
      const version = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 12);
      const template = readFileSync(fileURLToPath(new URL('./sw.js', import.meta.url)), 'utf8');
      const source = template.replace('self.__SHOP_PRECACHE__', JSON.stringify(precache)).replace('__SHOP_VERSION__', version);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}
