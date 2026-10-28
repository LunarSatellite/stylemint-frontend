/**
 * StyleMint's platform commission on product sales, by product category (platform-commission contract v1.0 §1, §3):
 * the rate per category, its history, and the date-range summary of what StyleMint earned. Rates are percents
 * (0–50, two decimals); money is decimal MAJOR units with a separate currency ("NPR").
 *
 * Every endpoint answers a bare 404 until the backend branch `feat/platform-commission` is deployed.
 *
 * Not to be confused with the bookings commission (./services `bookingsAdminApi.commission`), which hotels and travel
 * agencies pay and which is set on the Bookings page.
 */
import { http } from './client';

export const COMMISSION_MIN = 0;
export const COMMISSION_MAX = 50;

/** One category with its rate, as the server sends it. */
export interface CommissionCategoryRow {
  categoryId: string;
  name: string;
  parentId: string | null;
  /** For display, e.g. "Women › Dresses". The server may send it as a string or as the list of names. */
  path?: string | string[] | null;
  /** null = not set on this category: it inherits its parent's rate, else the default (0%). */
  ratePercent: number | null;
  /** What an order line in this category is charged now. */
  effectiveRatePercent: number;
  /** The ancestor the effective rate comes from, when this category has no rate of its own. */
  inheritedFrom?: string | { categoryId?: string; id?: string; name: string } | null;
  updatedUtc?: string | null;
  /** Admin account id of the last change. */
  updatedBy?: string | null;
  /** Display name of that admin, when the server sends it. */
  updatedByName?: string | null;
}

export interface CommissionCategories {
  /** Rate for a category with no rate anywhere up its tree. 0 at launch. */
  defaultRatePercent: number;
  categories: CommissionCategoryRow[];
}

/** One past value of a category's rate. */
export interface CommissionHistoryEntry {
  /** null = the rate was cleared (back to inherited / default). */
  ratePercent: number | null;
  changedUtc: string | null;
  changedBy: string | null;
  changedByName: string | null;
}

export interface CommissionSummary {
  currency: string;
  /** Settled platform-commission rows in the range. */
  earned: { amount: number; count: number };
  pending: { amount: number };
  reversed: { amount: number };
  byCategory: { categoryId: string; name: string; amount: number }[];
}

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** The list as `{ defaultRatePercent, categories }`, `{ defaultRatePercent, items }` or a bare array. */
export function toCommissionCategories(raw: unknown): CommissionCategories {
  if (Array.isArray(raw)) return { defaultRatePercent: 0, categories: raw as CommissionCategoryRow[] };
  const o = (raw ?? {}) as Raw;
  const list = (Array.isArray(o.categories) ? o.categories : Array.isArray(o.items) ? o.items : []) as Raw[];
  return {
    defaultRatePercent: numOrNull(o.defaultRatePercent) ?? 0,
    categories: list.map((c) => ({
      ...(c as unknown as CommissionCategoryRow),
      categoryId: String(c.categoryId ?? c.id ?? ''),
      name: String(c.name ?? ''),
      parentId: str(c.parentId),
      ratePercent: numOrNull(c.ratePercent),
      effectiveRatePercent: numOrNull(c.effectiveRatePercent) ?? numOrNull(c.ratePercent) ?? numOrNull(o.defaultRatePercent) ?? 0,
    })),
  };
}

/** History as a bare array or `{ items }`; field names tolerated in either the changed… or updated… form. */
export function toCommissionHistory(raw: unknown): CommissionHistoryEntry[] {
  const o = raw as Raw | unknown[] | null | undefined;
  const list = (Array.isArray(o) ? o : Array.isArray((o as Raw | null)?.items) ? ((o as Raw).items as unknown[]) : []) as Raw[];
  return list.map((h) => ({
    ratePercent: numOrNull(h.ratePercent),
    changedUtc: str(h.changedUtc) ?? str(h.updatedUtc) ?? str(h.effectiveFromUtc) ?? str(h.createdUtc),
    changedBy: str(h.changedBy) ?? str(h.updatedBy),
    changedByName: str(h.changedByName) ?? str(h.updatedByName),
  }));
}

/** The name of the ancestor a category inherits from, whichever form the server sends. */
export function inheritedName(row: Pick<CommissionCategoryRow, 'inheritedFrom'>): string | null {
  const f = row.inheritedFrom;
  if (!f) return null;
  if (typeof f === 'string') return f;
  return f.name || null;
}

/** The display path as text. */
export function pathText(row: Pick<CommissionCategoryRow, 'path' | 'name'>): string {
  if (Array.isArray(row.path)) return row.path.join(' › ');
  return row.path || row.name;
}

/**
 * A rate typed by an admin: a number from 0 to 50 with at most two decimals. Returns null when it is not one.
 * The empty string is not a rate here; clearing a rate is its own action.
 */
export function parseRate(raw: string): number | null {
  const s = raw.trim();
  if (s === '' || !/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < COMMISSION_MIN || n > COMMISSION_MAX) return null;
  return Math.round(n * 100) / 100;
}

const enc = encodeURIComponent;

export const commissionApi = {
  /** `GET /v1/admin/commission/categories` - every category with its rate. */
  categories: async (signal?: AbortSignal): Promise<CommissionCategories> => toCommissionCategories(await http.get<unknown>('/v1/admin/commission/categories', undefined, signal)),
  /** `PUT /v1/admin/commission/categories/{categoryId}` - `{ ratePercent }`, null clears. Idempotency-Key from the client. */
  setRate: (categoryId: string, ratePercent: number | null) => http.put<unknown>(`/v1/admin/commission/categories/${enc(categoryId)}`, { ratePercent }),
  /** `GET /v1/admin/commission/categories/{categoryId}/history` - past values, newest first. */
  history: async (categoryId: string, signal?: AbortSignal): Promise<CommissionHistoryEntry[]> =>
    toCommissionHistory(await http.get<unknown>(`/v1/admin/commission/categories/${enc(categoryId)}/history`, undefined, signal)),
  /** `GET /v1/admin/commission/summary?fromUtc&toUtc`. */
  summary: (fromUtc: string, toUtc: string, signal?: AbortSignal) => http.get<CommissionSummary>('/v1/admin/commission/summary', { fromUtc, toUtc }, signal),
};

// ── Tree ────────────────────────────────────────────────────────────────────

export interface CommissionTreeRow extends CommissionCategoryRow {
  depth: number;
}

/**
 * The categories in tree order (each parent followed by its children, siblings by name) with their depth. A category
 * whose parent is not in the list is treated as a root, and a cycle cannot loop.
 */
export function toTree(rows: CommissionCategoryRow[]): CommissionTreeRow[] {
  const ids = new Set(rows.map((r) => r.categoryId));
  const children = new Map<string | null, CommissionCategoryRow[]>();
  for (const r of rows) {
    const parent = r.parentId && ids.has(r.parentId) && r.parentId !== r.categoryId ? r.parentId : null;
    const list = children.get(parent) ?? [];
    list.push(r);
    children.set(parent, list);
  }
  for (const list of children.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  const out: CommissionTreeRow[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number) => {
    for (const r of children.get(parent) ?? []) {
      if (seen.has(r.categoryId)) continue;
      seen.add(r.categoryId);
      out.push({ ...r, depth });
      walk(r.categoryId, depth + 1);
    }
  };
  walk(null, 0);
  // Anything only reachable through a cycle.
  for (const r of rows) if (!seen.has(r.categoryId)) out.push({ ...r, depth: 0 });
  return out;
}

/**
 * Effective rate and "inherited from" for every row, from the rates alone: own rate, else the nearest ancestor's,
 * else the default. Used for the optimistic update before the server answers.
 */
export function withInheritance(data: CommissionCategories): CommissionCategories {
  const byId = new Map(data.categories.map((c) => [c.categoryId, c]));
  const resolve = (c: CommissionCategoryRow): { effective: number; from: string | null } => {
    const seen = new Set<string>([c.categoryId]);
    let p = c.parentId ? byId.get(c.parentId) : undefined;
    while (p && !seen.has(p.categoryId)) {
      if (p.ratePercent !== null) return { effective: p.ratePercent, from: p.name };
      seen.add(p.categoryId);
      p = p.parentId ? byId.get(p.parentId) : undefined;
    }
    return { effective: data.defaultRatePercent, from: null };
  };
  return {
    ...data,
    categories: data.categories.map((c) => {
      if (c.ratePercent !== null) return { ...c, effectiveRatePercent: c.ratePercent, inheritedFrom: null };
      const r = resolve(c);
      return { ...c, effectiveRatePercent: r.effective, inheritedFrom: r.from };
    }),
  };
}
