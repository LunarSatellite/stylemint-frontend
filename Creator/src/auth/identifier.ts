/**
 * The sign-in identifier: an email (Gmail or any) or a Nepali phone number.
 *
 * The backend is strict: email is lower-cased server-side, but a phone must arrive as exact E.164
 * (`^\+[1-9]\d{1,14}$`) — it only trims. So the web app normalises: strip spaces/dashes/brackets,
 * drop a leading 0 or 977/00977, then prefix +977. A number typed with another country code
 * (+91…) is kept as typed.
 */

/** Identity's OtpDestinationType — integers on the wire. */
export const IdentifierType = { Email: 1, Phone: 2 } as const;
export type IdentifierTypeValue = (typeof IdentifierType)[keyof typeof IdentifierType];

export type ParsedIdentifier =
  | { ok: true; type: IdentifierTypeValue; value: string; display: string }
  | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeNepalPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) return null;
  if (hasPlus) {
    // Already international. Accept it if it is plausible E.164.
    if (digits.startsWith('977')) return validNepal(digits.slice(3));
    return /^[1-9]\d{6,14}$/.test(digits) ? `+${digits}` : null;
  }
  if (digits.startsWith('00977')) digits = digits.slice(5);
  else if (digits.startsWith('977') && digits.length > 10) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  return validNepal(digits);
}

/** Nepali mobiles are 10 digits starting 9 (98x/97x/96x); landlines are shorter. Allow 7–10 digits. */
function validNepal(national: string): string | null {
  if (!/^\d{7,10}$/.test(national)) return null;
  return `+977${national}`;
}

export function parseIdentifier(raw: string): ParsedIdentifier {
  const value = raw.trim();
  if (!value) return { ok: false, error: 'Enter your email or phone number' };
  if (value.includes('@')) {
    const email = value.toLowerCase();
    if (!EMAIL.test(email)) return { ok: false, error: 'That email address does not look right' };
    return { ok: true, type: IdentifierType.Email, value: email, display: email };
  }
  if (/[a-z]/i.test(value)) return { ok: false, error: 'Enter a valid email or phone number' };
  const phone = normalizeNepalPhone(value);
  if (!phone) return { ok: false, error: 'Enter a valid phone number, e.g. 98XXXXXXXX' };
  return { ok: true, type: IdentifierType.Phone, value: phone, display: formatPhone(phone) };
}

/** "+977 981-2345678" */
export function formatPhone(e164: string): string {
  if (e164.startsWith('+977') && e164.length === 14) return `+977 ${e164.slice(4, 7)}-${e164.slice(7)}`;
  return e164;
}
