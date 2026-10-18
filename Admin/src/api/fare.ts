/**
 * Rider fare breakdown (`RiderFareBreakdown`, rider-fare contract v1): how a rider's fare for one hop is made up.
 *
 *   trip  = (baseFare + km x perKm) x tierMultiplier, at least minimumFare
 *   total = trip + extras, rounded to the nearest Rs 5
 *
 * Arrives as `fareBreakdown` (an object) on offers, hops, routing candidates and jobs; null for anything priced before
 * the breakdown shipped. Tiers are spelled "Pro" | "Traveler" | "Neighbor". Extra codes are stable
 * (`heavy_parcel`, `cash_collection`, `night`); labels are display text.
 */
export interface FareExtra {
  code: string;
  label: string;
  amount: number;
}

export interface RiderFareBreakdown {
  version?: number;
  method: 'road' | 'estimated' | string;
  roadKm: number | null;
  straightLineKm: number | null;
  roadDurationSeconds?: number | null;
  detourFactor: number | null;
  baseFare: number | null;
  perKm: number | null;
  distanceAmount: number | null;
  tier: string | null;
  tierMultiplier: number | null;
  tripAmount: number | null;
  minimumFare: number | null;
  minimumApplied: boolean;
  extras: FareExtra[];
  extrasAmount?: number | null;
  roundTo?: number | null;
  rounding: number | null;
  total: number;
  currency: string;
  computedUtc?: string | null;
}

/**
 * The payout ledger's own shape on an earning row (rider-payout contract v1): free-coded lines that sum to the amount.
 * Before the road fare ships there is a single `{ code: "fare" }` line.
 */
export interface FareLines {
  ref?: string | null;
  lines: { code: string; label: string; amount: number }[];
}

const TIER_LABEL: Record<string, string> = { pro: 'Pro', traveler: 'Traveller', traveller: 'Traveller', neighbor: 'Neighbour', neighbour: 'Neighbour' };

export function tierLabel(tier: string | null | undefined): string | null {
  if (!tier) return null;
  return TIER_LABEL[tier.trim().toLowerCase()] ?? tier;
}

/** A breakdown worth itemising: has a numeric total. Anything else (null, malformed, the ledger's lines) is not one. */
export function asFare(value: unknown): RiderFareBreakdown | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<RiderFareBreakdown>;
  if (typeof v.total !== 'number' || !Number.isFinite(v.total)) return null;
  return {
    method: v.method ?? 'estimated',
    roadKm: v.roadKm ?? null,
    straightLineKm: v.straightLineKm ?? null,
    roadDurationSeconds: v.roadDurationSeconds ?? null,
    detourFactor: v.detourFactor ?? null,
    baseFare: v.baseFare ?? null,
    perKm: v.perKm ?? null,
    distanceAmount: v.distanceAmount ?? null,
    tier: v.tier ?? null,
    tierMultiplier: v.tierMultiplier ?? null,
    tripAmount: v.tripAmount ?? null,
    minimumFare: v.minimumFare ?? null,
    minimumApplied: v.minimumApplied === true,
    extras: Array.isArray(v.extras) ? v.extras.filter((e) => e && typeof e.amount === 'number') : [],
    extrasAmount: v.extrasAmount ?? null,
    roundTo: v.roundTo ?? null,
    rounding: v.rounding ?? null,
    total: v.total,
    currency: v.currency || 'NPR',
    computedUtc: v.computedUtc ?? null,
  };
}

/** The ledger's `{ lines }` form, when that is what came. */
export function asFareLines(value: unknown): FareLines | null {
  if (!value || typeof value !== 'object') return null;
  const lines = (value as { lines?: unknown }).lines;
  if (!Array.isArray(lines)) return null;
  return {
    ref: (value as FareLines).ref ?? null,
    lines: lines.filter((l): l is FareLines['lines'][number] => !!l && typeof l === 'object' && typeof (l as { amount?: unknown }).amount === 'number'),
  };
}

/** "7.4 km by road" / "7.4 km, estimated". */
export function fareDistance(fare: RiderFareBreakdown): string {
  const road = fare.method === 'road';
  if (fare.roadKm == null) return road ? 'by road' : 'estimated';
  return `${fare.roadKm.toFixed(1)} km${road ? ' by road' : ', estimated'}`;
}

/** What the tier multiplier added (+) or took off (-) base + distance; null when the minimum replaced it. */
export function tierAdjustment(fare: RiderFareBreakdown): number | null {
  if (fare.minimumApplied || fare.tripAmount == null || fare.baseFare == null || fare.distanceAmount == null) return null;
  const delta = fare.tripAmount - (fare.baseFare + fare.distanceAmount);
  return Math.abs(delta) < 0.005 ? 0 : delta;
}
