import dayjs from 'dayjs';

/**
 * Date ranges for Insights: a preset or a custom range, the equally long period right before it
 * (for "compare to previous period"), deltas, and the bucketing of a daily series into days /
 * weeks / months. Pure functions — the page keeps the range in the URL (`?range=30d&compare=1` or
 * `?from=2026-09-01&to=2026-09-30`) so a link or a reload shows the same numbers.
 */

export type PresetKey = '7d' | '30d' | '90d' | 'mtd' | 'lastMonth' | 'custom';
export type Grain = 'day' | 'week' | 'month';

/** `from` inclusive, `to` exclusive. */
export interface Period {
  from: Date;
  to: Date;
}

export interface InsightsRange {
  preset: PresetKey;
  current: Period;
  previous: Period;
  compare: boolean;
  grain: Grain;
}

export const PRESETS: { value: PresetKey; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'mtd', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'custom', label: 'Custom range' },
];

/** The backend analytics windows allow at most a year. */
export const MAX_DAYS = 365;

const DAY_MS = 86_400_000;

export function startOfDay(d: Date): Date {
  return dayjs(d).startOf('day').toDate();
}

export function presetPeriod(key: Exclude<PresetKey, 'custom'>, now: Date = new Date()): Period {
  const today = dayjs(now).startOf('day');
  switch (key) {
    case '7d':
      return { from: today.subtract(6, 'day').toDate(), to: now };
    case '30d':
      return { from: today.subtract(29, 'day').toDate(), to: now };
    case '90d':
      return { from: today.subtract(89, 'day').toDate(), to: now };
    case 'mtd':
      return { from: today.startOf('month').toDate(), to: now };
    case 'lastMonth': {
      const start = today.startOf('month').subtract(1, 'month');
      return { from: start.toDate(), to: start.add(1, 'month').toDate() };
    }
  }
}

/** A custom range of whole days, `lastDay` included; never past `now`. */
export function customPeriod(firstDay: Date, lastDay: Date, now: Date = new Date()): Period {
  const [a, b] = firstDay <= lastDay ? [firstDay, lastDay] : [lastDay, firstDay];
  const from = startOfDay(a);
  const end = dayjs(b).startOf('day').add(1, 'day').toDate();
  return { from, to: end > now ? now : end };
}

export function periodMs(p: Period): number {
  return Math.max(0, p.to.getTime() - p.from.getTime());
}

/** Whole calendar days the period touches (a part day counts). */
export function periodDays(p: Period): number {
  return Math.max(1, Math.ceil(periodMs(p) / DAY_MS));
}

/** The period of the same length that ends where this one starts. */
export function previousPeriod(p: Period): Period {
  const len = periodMs(p);
  return { from: new Date(p.from.getTime() - len), to: new Date(p.from.getTime()) };
}

export function defaultGrain(days: number): Grain {
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

/**
 * Change from `previous` to `current` in percent. `null` when there is nothing to compare with
 * (previous is 0 or missing) — the UI says "new" instead of a meaningless "+∞ %".
 */
export function deltaPercent(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** For rates (conversion, return rate): the difference in percentage points. Inputs are fractions (0.034) or percents — both the same unit. */
export function pointDelta(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  return current - previous;
}

/** a / b, or null when b is 0. */
export function ratio(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a === null || a === undefined || b === null || b === undefined || !Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return a / b;
}

const ISO_DAY = 'YYYY-MM-DD';

export function isoDay(d: Date): string {
  return dayjs(d).format(ISO_DAY);
}

function parseDay(s: string | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = dayjs(s, ISO_DAY);
  return d.isValid() ? d.toDate() : null;
}

/** Read the range from the URL. Anything invalid falls back to the last 30 days. */
export function rangeFromSearch(params: URLSearchParams, now: Date = new Date()): InsightsRange {
  const compare = params.get('compare') !== '0';
  const from = parseDay(params.get('from'));
  const to = parseDay(params.get('to'));
  let preset = (params.get('range') as PresetKey | null) ?? '30d';
  let current: Period;
  if (from && to) {
    current = customPeriod(from, to, now);
    if (periodDays(current) > MAX_DAYS) current = { from: dayjs(current.to).subtract(MAX_DAYS, 'day').toDate(), to: current.to };
    preset = 'custom';
  } else {
    if (!PRESETS.some((p) => p.value === preset) || preset === 'custom') preset = '30d';
    current = presetPeriod(preset as Exclude<PresetKey, 'custom'>, now);
  }
  return { preset, current, previous: previousPeriod(current), compare, grain: defaultGrain(periodDays(current)) };
}

/** The URL search for a range choice. */
export function searchFor(choice: { preset: PresetKey; from?: Date; to?: Date; compare: boolean }): URLSearchParams {
  const p = new URLSearchParams();
  if (choice.preset === 'custom' && choice.from && choice.to) {
    p.set('from', isoDay(choice.from));
    p.set('to', isoDay(choice.to));
  } else if (choice.preset !== 'custom') {
    p.set('range', choice.preset);
  }
  if (!choice.compare) p.set('compare', '0');
  return p;
}

/** The query every analytics endpoint takes. */
export function windowQuery(p: Period): { fromUtc: string; toUtc: string } {
  return { fromUtc: p.from.toISOString(), toUtc: p.to.toISOString() };
}

/** "1 Oct – 13 Oct 2026" */
export function formatPeriod(p: Period): string {
  const a = dayjs(p.from);
  // `to` is exclusive: the last day shown is the day before it (or the same day when it is "now").
  const lastMs = p.to.getTime() - 1;
  const b = dayjs(lastMs < p.from.getTime() ? p.from : new Date(lastMs));
  if (a.isSame(b, 'day')) return a.format('D MMM YYYY');
  if (a.year() === b.year()) return `${a.format('D MMM')} – ${b.format('D MMM YYYY')}`;
  return `${a.format('D MMM YYYY')} – ${b.format('D MMM YYYY')}`;
}

export interface SeriesPoint {
  /** ISO day "2026-10-01" (or a full ISO timestamp; only the day is used). */
  date: string;
  value: number;
}

export interface Bucket {
  key: string;
  label: string;
  value: number;
}

function bucketKey(d: dayjs.Dayjs, grain: Grain): dayjs.Dayjs {
  if (grain === 'month') return d.startOf('month');
  if (grain === 'week') {
    // Weeks start on Sunday (Nepal's working week starts Sunday).
    return d.startOf('day').subtract(d.day(), 'day');
  }
  return d.startOf('day');
}

function bucketLabel(d: dayjs.Dayjs, grain: Grain): string {
  if (grain === 'month') return d.format('MMM YYYY');
  return d.format('D MMM');
}

/**
 * Daily points → one bucket per day / week / month across the whole period, missing days as 0,
 * so a quiet day shows as a dip instead of disappearing.
 */
export function bucketSeries(points: SeriesPoint[], period: Period, grain: Grain): Bucket[] {
  const buckets = new Map<string, Bucket>();
  const start = dayjs(period.from).startOf('day');
  const lastMs = Math.max(period.from.getTime(), period.to.getTime() - 1);
  const end = dayjs(lastMs).startOf('day');
  for (let d = start; !d.isAfter(end, 'day'); d = d.add(1, 'day')) {
    const k = bucketKey(d, grain);
    const key = k.format(ISO_DAY);
    if (!buckets.has(key)) buckets.set(key, { key, label: bucketLabel(k, grain), value: 0 });
  }
  for (const p of points) {
    const day = dayjs(p.date.slice(0, 10), ISO_DAY);
    if (!day.isValid()) continue;
    const key = bucketKey(day, grain).format(ISO_DAY);
    const b = buckets.get(key);
    if (b) b.value += Number(p.value) || 0;
  }
  return [...buckets.values()];
}

export interface ComparePoint {
  label: string;
  current: number;
  previous: number | null;
}

/** Current and previous buckets side by side, matched by position (day 1 with day 1…). */
export function alignCompare(current: Bucket[], previous: Bucket[] | null): ComparePoint[] {
  return current.map((b, i) => ({
    label: b.label,
    current: b.value,
    previous: previous ? (previous[i]?.value ?? 0) : null,
  }));
}

export function sumOf(buckets: { value: number }[]): number {
  return buckets.reduce((s, b) => s + (Number(b.value) || 0), 0);
}

/** The new `v1/vendor/insights/*` reads take inclusive Kathmandu calendar days: `from` / `to` = "yyyy-MM-dd". */
export function dayQuery(p: Period): { from: string; to: string } {
  const lastMs = Math.max(p.from.getTime(), p.to.getTime() - 1);
  return { from: isoDay(p.from), to: isoDay(new Date(lastMs)) };
}
