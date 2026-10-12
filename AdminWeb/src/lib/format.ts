/** Display helpers. Dates are shown in the operator's local time zone with the UTC value on hover. */

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDateTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? dateTime.format(d) : '—';
}

export function fmtDate(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? dateOnly.format(d) : '—';
}

export function fmtIso(value: string | number | Date | null | undefined): string | undefined {
  return toDate(value)?.toISOString();
}

export function fmtRelative(value: string | number | Date | null | undefined, now = Date.now()): string {
  const d = toDate(value);
  if (!d) return '—';
  const seconds = Math.round((d.getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return relative.format(seconds, 'second');
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86400 * 30) return relative.format(Math.round(seconds / 86400), 'day');
  return dateOnly.format(d);
}

/**
 * Money. StyleMint amounts are decimal major units (NPR 1,250.00) unless a field says `Minor`/`Paisa`, in which case
 * pass `{ minor: true }`.
 */
export function fmtMoney(amount: number | string | null | undefined, currency: string | null | undefined = 'NPR', opts: { minor?: boolean } = {}): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return '—';
  const value = opts.minor ? n / 100 : n;
  const code = (currency || 'NPR').toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code, currencyDisplay: 'code', maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${code} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
}

export function fmtNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits > 0 ? Math.min(digits, 1) : 0 });
}

export function fmtPercent(value: number | null | undefined, digits = 1, { fraction = false } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const v = fraction ? value * 100 : value;
  return `${v.toFixed(digits)}%`;
}

/**
 * Masks an identity number for display: only the last four characters show. The full value is never needed to
 * decide a KYC case - the document image is the evidence - and a screen over a shoulder should not leak it.
 */
export function mask(value: string | null | undefined, visible = 4): string {
  if (!value) return '—';
  const clean = value.trim();
  if (clean.length <= visible) return '•'.repeat(clean.length);
  return `${'•'.repeat(Math.min(8, clean.length - visible))}${clean.slice(-visible)}`;
}

export function maskEmail(value: string | null | undefined): string {
  if (!value) return '—';
  const [user, domain] = value.split('@');
  if (!domain || !user) return mask(value);
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, Math.min(6, user.length - 2)))}@${domain}`;
}

export function maskPhone(value: string | null | undefined): string {
  if (!value) return '—';
  const digits = value.replace(/\s+/g, '');
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, Math.min(4, digits.length - 4))}${'•'.repeat(Math.max(0, digits.length - 8))}${digits.slice(-4)}`;
}

/** "PendingReview" / "pending_review" / "PENDING_REVIEW" -> "Pending review". */
export function humanize(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const s = String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}
