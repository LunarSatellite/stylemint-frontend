import { describe, expect, it } from 'vitest';
import {
  alignCompare,
  bucketSeries,
  customPeriod,
  defaultGrain,
  deltaPercent,
  formatPeriod,
  isoDay,
  periodDays,
  pointDelta,
  presetPeriod,
  previousPeriod,
  rangeFromSearch,
  ratio,
  searchFor,
  sumOf,
} from './period';

const NOW = new Date(2026, 9, 13, 15, 30); // 13 Oct 2026, 15:30 local

describe('periods', () => {
  it('builds presets that end now and start at local midnight', () => {
    const p = presetPeriod('7d', NOW);
    expect(isoDay(p.from)).toBe('2026-10-07');
    expect(p.from.getHours()).toBe(0);
    expect(p.to).toEqual(NOW);
    expect(periodDays(p)).toBe(7);
    expect(isoDay(presetPeriod('30d', NOW).from)).toBe('2026-09-14');
    expect(isoDay(presetPeriod('mtd', NOW).from)).toBe('2026-10-01');
  });

  it('takes last month as whole days, end exclusive', () => {
    const p = presetPeriod('lastMonth', NOW);
    expect(isoDay(p.from)).toBe('2026-09-01');
    expect(isoDay(p.to)).toBe('2026-10-01');
    expect(periodDays(p)).toBe(30);
  });

  it('compares with the period of equal length right before', () => {
    const p = presetPeriod('lastMonth', NOW);
    const prev = previousPeriod(p);
    expect(prev.to).toEqual(p.from);
    expect(prev.to.getTime() - prev.from.getTime()).toBe(p.to.getTime() - p.from.getTime());
    expect(isoDay(prev.from)).toBe('2026-08-02');
  });

  it('makes a custom range of whole days in any order, never past now', () => {
    const p = customPeriod(new Date(2026, 9, 5), new Date(2026, 9, 1), NOW);
    expect(isoDay(p.from)).toBe('2026-10-01');
    expect(isoDay(p.to)).toBe('2026-10-06');
    const today = customPeriod(new Date(2026, 9, 10), new Date(2026, 9, 13), NOW);
    expect(today.to).toEqual(NOW);
  });

  it('picks day / week / month buckets by length', () => {
    expect(defaultGrain(7)).toBe('day');
    expect(defaultGrain(31)).toBe('day');
    expect(defaultGrain(90)).toBe('week');
    expect(defaultGrain(365)).toBe('month');
  });

  it('formats the period for the caption', () => {
    expect(formatPeriod(presetPeriod('lastMonth', NOW))).toBe('1 Sep – 30 Sep 2026');
    expect(formatPeriod(presetPeriod('7d', NOW))).toBe('7 Oct – 13 Oct 2026');
  });
});

describe('compare math', () => {
  it('computes percent change against the previous period', () => {
    expect(deltaPercent(125, 100)).toBe(25);
    expect(deltaPercent(80, 100)).toBe(-20);
    expect(deltaPercent(-50, -100)).toBe(50);
  });

  it('has no percentage when there was nothing before (shown as "new")', () => {
    expect(deltaPercent(10, 0)).toBeNull();
    expect(deltaPercent(0, 0)).toBe(0);
    expect(deltaPercent(null, 5)).toBeNull();
    expect(deltaPercent(5, undefined)).toBeNull();
    expect(deltaPercent(Number.NaN, 5)).toBeNull();
  });

  it('compares rates in percentage points', () => {
    expect(pointDelta(3.4, 3)).toBeCloseTo(0.4);
    expect(pointDelta(null, 3)).toBeNull();
  });

  it('divides safely', () => {
    expect(ratio(50, 200)).toBe(0.25);
    expect(ratio(5, 0)).toBeNull();
    expect(ratio(null, 3)).toBeNull();
  });
});

describe('series', () => {
  const period = customPeriod(new Date(2026, 9, 1), new Date(2026, 9, 7), new Date(2026, 9, 20));

  it('fills missing days with zero so quiet days show as dips', () => {
    const b = bucketSeries(
      [
        { date: '2026-10-02', value: 100 },
        { date: '2026-10-02T00:00:00Z', value: 50 },
        { date: '2026-10-05', value: 30 },
        { date: '2026-09-30', value: 999 }, // outside the period
      ],
      period,
      'day',
    );
    expect(b).toHaveLength(7);
    expect(b.map((x) => x.value)).toEqual([0, 150, 0, 0, 30, 0, 0]);
    expect(sumOf(b)).toBe(180);
  });

  it('groups into weeks starting on Sunday and into months', () => {
    // 1 Oct 2026 is a Thursday → weeks of 27 Sep and 4 Oct.
    const weeks = bucketSeries([{ date: '2026-10-01', value: 1 }, { date: '2026-10-04', value: 2 }, { date: '2026-10-07', value: 3 }], period, 'week');
    expect(weeks.map((w) => w.key)).toEqual(['2026-09-27', '2026-10-04']);
    expect(weeks.map((w) => w.value)).toEqual([1, 5]);
    const months = bucketSeries([{ date: '2026-10-03', value: 4 }], period, 'month');
    expect(months).toEqual([{ key: '2026-10-01', label: 'Oct 2026', value: 4 }]);
  });

  it('lines the previous period up by position', () => {
    const cur = [
      { key: 'a', label: '1 Oct', value: 10 },
      { key: 'b', label: '2 Oct', value: 20 },
    ];
    const prev = [{ key: 'x', label: '30 Sep', value: 5 }];
    expect(alignCompare(cur, prev)).toEqual([
      { label: '1 Oct', current: 10, previous: 5 },
      { label: '2 Oct', current: 20, previous: 0 },
    ]);
    expect(alignCompare(cur, null)[0].previous).toBeNull();
  });
});

describe('range in the URL', () => {
  it('defaults to the last 30 days with compare on', () => {
    const r = rangeFromSearch(new URLSearchParams(''), NOW);
    expect(r.preset).toBe('30d');
    expect(r.compare).toBe(true);
    expect(r.grain).toBe('day');
    expect(r.previous.to).toEqual(r.current.from);
  });

  it('reads a custom range and compare off, and round-trips it', () => {
    const r = rangeFromSearch(new URLSearchParams('from=2026-08-01&to=2026-09-30&compare=0'), NOW);
    expect(r.preset).toBe('custom');
    expect(r.compare).toBe(false);
    expect(isoDay(r.current.from)).toBe('2026-08-01');
    expect(periodDays(r.current)).toBe(61);
    expect(r.grain).toBe('week');
    const s = searchFor({ preset: 'custom', from: r.current.from, to: new Date(2026, 8, 30), compare: false });
    expect(s.toString()).toBe('from=2026-08-01&to=2026-09-30&compare=0');
  });

  it('falls back on nonsense', () => {
    expect(rangeFromSearch(new URLSearchParams('range=forever'), NOW).preset).toBe('30d');
    expect(rangeFromSearch(new URLSearchParams('from=yesterday&to=2026-10-01'), NOW).preset).toBe('30d');
    expect(searchFor({ preset: '7d', compare: true }).toString()).toBe('range=7d');
  });

  it('caps a custom range at a year', () => {
    const r = rangeFromSearch(new URLSearchParams('from=2020-01-01&to=2026-10-01'), NOW);
    expect(periodDays(r.current)).toBeLessThanOrEqual(365);
  });
});
