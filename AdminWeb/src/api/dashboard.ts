/**
 * The platform summary (`GET /v1/admin/dashboard/summary`) is being added by the backend; until it ships the request
 * is a 404 and the dashboard shows only the work queues, which it counts from the list endpoints the operator's roles
 * can already read (asking each for one row and reading `totalCount`).
 */
import { http } from './client';
import { ApiError } from './errors';

export type DashboardSummary = Record<string, unknown>;

export const dashboardApi = {
  summary: async (signal?: AbortSignal): Promise<DashboardSummary | null> => {
    try {
      return await http.get<DashboardSummary>('/v1/admin/dashboard/summary', undefined, signal);
    } catch (error) {
      if (error instanceof ApiError && error.isMissingEndpoint) return null;
      throw error;
    }
  },
};

export interface SummaryTile {
  key: string;
  label: string;
  value: number;
  /** Money when the key says so. */
  money?: boolean;
  currency?: string;
}

const MONEY = /(amount|revenue|gmv|sales|value|total)(npr)?$/i;

function label(path: string[]): string {
  return path
    .map((p) => p.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' '))
    .join(' · ')
    .replace(/\b(utc|id)\b/gi, (m) => m.toUpperCase())
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Flattens whatever the summary returns into labelled numbers - so a field the backend adds appears without a
 * console release, and a field it renames does not break the page. Timestamps and ids are skipped.
 */
export function summaryTiles(summary: DashboardSummary, max = 16): SummaryTile[] {
  const out: SummaryTile[] = [];
  const currency = typeof summary.currency === 'string' ? summary.currency : 'NPR';
  const walk = (value: unknown, path: string[]) => {
    if (out.length >= max) return;
    if (typeof value === 'number' && Number.isFinite(value)) {
      const key = path.join('.');
      if (/(utc|id|version)$/i.test(path[path.length - 1] ?? '')) return;
      out.push({ key, label: label(path), value, money: MONEY.test(path[path.length - 1] ?? ''), currency });
      return;
    }
    if (value && typeof value === 'object' && !Array.isArray(value) && path.length < 3) {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) walk(v, [...path, k]);
    }
  };
  walk(summary, []);
  return out;
}
