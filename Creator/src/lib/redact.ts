/**
 * Buyer phone numbers and email addresses never reach the screen (copied from Seller Center's CRM
 * `redact.ts`, extended for Creator Studio).
 *
 * Creator-facing endpoints should not carry buyer contact details, but some return people (tippers,
 * commenters, activity actors, drop-party guests). The HTTP client therefore runs every response through
 * `dropContactFields` (the default privacy mode), and endpoints that carry text written by buyers
 * (comments, tip messages, story replies, notifications, activity) also through `maskText`.
 *
 * - Any property whose name is about email / phone / mobile / WhatsApp / an address to send to is
 *   dropped when it holds text. Booleans such as `hasEmail` stay (they say nothing about anyone).
 * - Free text has email addresses and phone-like numbers masked (mode `mask-text`).
 * - Machine JSON (`…Json`), ids and URLs are left alone.
 * - The creator's own account (`/v1/accounts/{self}`) and the sign-in endpoints opt out (mode `none`).
 */


const CONTACT_KEY = /e-?mail|phone|mobile|msisdn|whats-?app|toaddress|fromaddress|sms(number|to)?$/i;
const SKIP_TEXT_KEYS = /json$|^bodytemplate$|url$|token$|^id$|id$|ids$/i;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// 10–15 digits, optionally starting with + and split by single spaces / dashes / dots / brackets.
// Dates ("2026-10-13") and short numbers have too few digits to match; a number glued to letters,
// "#", "-" or "/" (order numbers like SM-2026101200123) is not a phone number.
const PHONE = /(?<![\w#/-])\+?\(?\d(?:[\s.()-]?\d){9,14}(?![\w/-])/g;

export const EMAIL_MASK = '[email hidden]';
export const PHONE_MASK = '[phone hidden]';

export function maskText(text: string): string {
  return text.replace(EMAIL, EMAIL_MASK).replace(PHONE, PHONE_MASK);
}

function isContactValue(value: unknown): boolean {
  if (typeof value === 'string') return true;
  if (Array.isArray(value)) return value.every((v) => typeof v === 'string' || (v && typeof v === 'object'));
  return false;
}

export type PrivacyMode = 'contact-fields' | 'mask-text' | 'none';

/** Drops contact fields everywhere; with `mask-text` also masks emails/phone numbers inside text. */
export function redactPii<T>(value: T, mode: PrivacyMode = 'mask-text'): T {
  if (mode === 'none') return value;
  return walk(value, null, mode === 'mask-text') as T;
}

/** The client's default: drop contact-named fields, leave text alone (captions are the creator's own). */
export function dropContactFields<T>(value: T): T {
  return redactPii(value, 'contact-fields');
}

function walk(value: unknown, key: string | null, mask: boolean): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (!mask || (key && SKIP_TEXT_KEYS.test(key))) return value;
    return maskText(value);
  }
  if (Array.isArray(value)) return value.map((v) => walk(v, key, mask));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (CONTACT_KEY.test(k) && !/^(has|is|can)[A-Z_]/.test(k) && isContactValue(v)) continue;
      out[k] = walk(v, k, mask);
    }
    return out;
  }
  return value;
}
