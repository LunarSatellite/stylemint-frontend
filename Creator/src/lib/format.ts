import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

/** Money as the API sends it: `{ amount, currency }`, amount in whole currency units (decimals allowed). */
export interface Money {
  amount: number;
  currency: string;
}

const npr = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const npr2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * "Rs 1,234" / "Rs 1,234.50" — the same "Rs " prefix and grouping as the StyleMint mobile app.
 * Accepts a Money object or a bare number (assumed NPR). Null/undefined → "—".
 */
export function formatMoney(value: Money | number | null | undefined, opts: { decimals?: 'auto' | 2 } = {}): string {
  if (value === null || value === undefined) return '—';
  const amount = typeof value === 'number' ? value : value.amount;
  const currency = typeof value === 'number' ? 'NPR' : value.currency || 'NPR';
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—';
  const n = Number(amount);
  const body = (opts.decimals === 2 ? npr2 : npr).format(Math.abs(n));
  const sign = n < 0 ? '-' : '';
  const prefix = currency === 'NPR' ? 'Rs ' : `${currency} `;
  return `${sign}${prefix}${body}`;
}

/** "Rs 950", "Rs 1.8K", "Rs 2.5M" — for tiles and chips. */
export function formatMoneyCompact(value: Money | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const amount = Number(typeof value === 'number' ? value : value.amount);
  const currency = typeof value === 'number' ? 'NPR' : value.currency || 'NPR';
  const prefix = currency === 'NPR' ? 'Rs ' : `${currency} `;
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs < 1000) return `${sign}${prefix}${Math.round(abs)}`;
  const units: [number, string][] = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [unit, suffix] of units) {
    if (abs >= unit) {
      const scaled = abs / unit;
      let text = scaled.toFixed(scaled < 100 ? 1 : 0);
      if (text.endsWith('.0')) text = text.slice(0, -2);
      return `${sign}${prefix}${text}${suffix}`;
    }
  }
  return `${sign}${prefix}${abs}`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('en-US').format(n);
}

/** "12 Oct 2026, 14:05" in the viewer's zone (Nepal for most creators). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = dayjs(iso);
  return d.isValid() ? d.format('D MMM YYYY, HH:mm') : '—';
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = dayjs(iso);
  return d.isValid() ? d.format('D MMM YYYY') : '—';
}

/** "3 hours ago" */
export function fromNow(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = dayjs(iso);
  return d.isValid() ? d.fromNow() : '—';
}

/** "PendingAcceptance" → "Pending acceptance" */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  const spaced = value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "12.4K", "1.2M" — view and follower counts. */
export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n));
}

/** A 0–1 fraction as a percentage: 0.034 → "3.4%". */
export function formatPercent(fraction: number | null | undefined, digits = 1): string {
  if (fraction === null || fraction === undefined || Number.isNaN(Number(fraction))) return '—';
  return `${(Number(fraction) * 100).toFixed(digits)}%`;
}

/** A value already in percent: 12.5 → "12.5%". */
export function formatPercentValue(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  return `${Number.isInteger(n) ? n : n.toFixed(digits)}%`;
}

/** "0:45", "12:03" from seconds. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return '—';
  const s = Math.max(0, Math.round(Number(seconds)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A label from an integer-enum map, "Unknown (7)" for a value this build does not know yet. */
export function labelOf(map: Record<number, string>, value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return map[value] ?? `Unknown (${value})`;
}
