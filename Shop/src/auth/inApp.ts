/**
 * In-app browser detection (contract A4). Instagram, Facebook, Messenger, TikTok, Snapchat and LINE open links
 * in their own webview, where Google refuses to sign in ("disallowed_useragent"). There the shop hides Google,
 * offers to reopen the page in the real browser, and carries the cart over with a hand-off token.
 */

export type InAppName = 'instagram' | 'facebook' | 'messenger' | 'tiktok' | 'snapchat' | 'line';
export type MobileOs = 'android' | 'ios' | 'other';

export interface BrowserContext {
  inApp: InAppName | null;
  os: MobileOs;
  /** Facebook sign-in works inside Facebook's and Messenger's own webviews. */
  facebookWorks: boolean;
  /** Google sign-in is refused by Google in every embedded webview. */
  googleWorks: boolean;
}

const PATTERNS: [RegExp, InAppName][] = [
  [/Instagram/i, 'instagram'],
  [/Messenger|FB_IAB\/MESSENGER|FBAN\/Messenger/i, 'messenger'],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, 'facebook'],
  [/TikTok|musical_ly|BytedanceWebview|trill_/i, 'tiktok'],
  [/Snapchat/i, 'snapchat'],
  [/\bLine\//, 'line'],
];

export function detectBrowser(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): BrowserContext {
  let inApp: InAppName | null = null;
  for (const [re, name] of PATTERNS) {
    if (re.test(ua)) {
      inApp = name;
      break;
    }
  }
  const os: MobileOs = /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : 'other';
  return {
    inApp,
    os,
    facebookWorks: inApp === null || inApp === 'facebook' || inApp === 'messenger',
    googleWorks: inApp === null,
  };
}

export const IN_APP_LABEL: Record<InAppName, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  messenger: 'Messenger',
  tiktok: 'TikTok',
  snapchat: 'Snapchat',
  line: 'LINE',
};

/** The https URL of the current page with `restore={token}` added (any previous restore dropped). */
export function withRestoreToken(href: string, token: string | null): string {
  const url = new URL(href);
  url.searchParams.delete('restore');
  if (token) url.searchParams.set('restore', token);
  return url.toString();
}

/**
 * Android: an `intent://` URL that opens the same page in Chrome; if Chrome is missing, Android follows
 * `S.browser_fallback_url` (the plain https URL) in the default browser.
 * `intent://{host}{path}?{query}&restore={token}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url={encoded};end`
 */
export function chromeIntentUrl(href: string, token: string | null): string {
  const target = new URL(withRestoreToken(href, token));
  const rest = `${target.host}${target.pathname}${target.search}`;
  return `intent://${rest}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(target.toString())};end`;
}
