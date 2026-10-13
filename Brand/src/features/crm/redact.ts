/**
 * Buyer phone numbers and email addresses never reach the screen.
 *
 * The seller CRM is meant to hold no buyer phone/email at all (the StyleMint → CRM sync leaves
 * them out). This is the belt to that suspender: every CRM response passes through `redactPii`
 * before any component sees it, so a field the backend forgot to strip — or a phone number typed
 * into a note — is removed or masked here.
 *
 * - Any property whose name is about email / phone / mobile / WhatsApp / an address to send to is
 *   dropped when it holds text. Booleans such as `hasEmail` stay (they say nothing about the buyer).
 * - Free text (notes, summaries, comments…) has email addresses and phone-like numbers masked.
 * - Seller-authored templates and machine JSON (`…Json`) are left alone.
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

export function redactPii<T>(value: T): T {
  return walk(value, null) as T;
}

function walk(value: unknown, key: string | null): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (key && SKIP_TEXT_KEYS.test(key)) return value;
    return maskText(value);
  }
  if (Array.isArray(value)) return value.map((v) => walk(v, key));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (CONTACT_KEY.test(k) && !/^(has|is|can)[A-Z_]/.test(k) && isContactValue(v)) continue;
      out[k] = walk(v, k);
    }
    return out;
  }
  return value;
}

/** Deep camelCase of object keys — OmniFlow DTOs are camelCase already, a few nested shapes are not. */
export function camelizeKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => camelizeKeys(v)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const ck = /^[A-Z][a-z]/.test(k) ? k.charAt(0).toLowerCase() + k.slice(1) : k;
      out[ck] = camelizeKeys(v);
    }
    return out as T;
  }
  return value;
}
