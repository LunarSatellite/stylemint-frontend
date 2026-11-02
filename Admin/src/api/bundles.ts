/**
 * Multi-shop bundles — D:\Stylemint\wt\shop-bundles-contract.md §B ("Admin" task list, §B5 admin routes).
 * Admin uses `/v1/admin/bundles/...` with the same bodies as the owner API: list / search every bundle, look at one,
 * create and edit StyleMint (platform-owned) bundles, take any bundle down with a note, resume a takedown, archive.
 * Enums arrive as names in the contract example; `normalizeBundle` also accepts the numbers. Every route answers a
 * bare 404 until the backend branch is deployed (`ApiError.isMissingEndpoint`).
 */
import { http } from './client';
import { ApiError, messageOf } from './errors';
import { toPage, type Page } from './paging';

export type BundleState = 'Draft' | 'PendingAcceptance' | 'Live' | 'Paused' | 'Archived' | 'Unknown';
export type ShopState = 'Invited' | 'Pending' | 'Accepted' | 'Declined' | 'Withdrawn' | 'Removed' | 'Unknown';
export type OwnerKind = 'Platform' | 'Creator' | 'Vendor' | 'Unknown';
export type PausedReason = 'OwnerPaused' | 'ShopWithdrew' | 'TermsChanged' | 'AdminTakedown' | 'ItemRemovedFromCatalog';
export type MyRole = 'Owner' | 'Shop' | null;

const STATES: BundleState[] = ['Draft', 'PendingAcceptance', 'Live', 'Paused', 'Archived'];
const SHOP_STATES: ShopState[] = ['Invited', 'Pending', 'Accepted', 'Declined', 'Withdrawn', 'Removed'];
const OWNER_KINDS: OwnerKind[] = ['Platform', 'Creator', 'Vendor'];
const PAUSED: PausedReason[] = ['OwnerPaused', 'ShopWithdrew', 'TermsChanged', 'AdminTakedown', 'ItemRemovedFromCatalog'];

/** A wire enum (name or 1-based number) → its name; anything else → fallback. */
function enumName<T extends string>(names: readonly T[], value: unknown, fallback: T): T;
function enumName<T extends string>(names: readonly T[], value: unknown, fallback: null): T | null;
function enumName<T extends string>(names: readonly T[], value: unknown, fallback: T | null): T | null {
  if (typeof value === 'number') return names[value - 1] ?? fallback;
  if (typeof value === 'string') {
    if (/^\d+$/.test(value)) return names[Number(value) - 1] ?? fallback;
    const hit = names.find((n) => n.toLowerCase() === value.toLowerCase());
    return hit ?? fallback;
  }
  return fallback;
}

export const toBundleState = (v: unknown) => enumName(STATES, v, 'Unknown' as BundleState);
export const toShopState = (v: unknown) => enumName(SHOP_STATES, v, 'Unknown' as ShopState);
export const toOwnerKind = (v: unknown) => enumName(OWNER_KINDS, v, 'Unknown' as OwnerKind);
export const toPausedReason = (v: unknown) => enumName(PAUSED, v, null);
export function toMyRole(v: unknown): MyRole {
  if (v === 1 || v === 'Owner' || v === 'owner') return 'Owner';
  if (v === 2 || v === 'Shop' || v === 'shop') return 'Shop';
  return null;
}

export const stateLabel: Record<BundleState, string> = {
  Draft: 'Draft',
  PendingAcceptance: 'Waiting for shops',
  Live: 'Live',
  Paused: 'Paused',
  Archived: 'Archived',
  Unknown: 'Unknown',
};
export const stateColor: Record<BundleState, string> = {
  Draft: 'gray',
  PendingAcceptance: 'amber',
  Live: 'forest',
  Paused: 'signal',
  Archived: 'slate',
  Unknown: 'gray',
};
export const shopStateLabel: Record<ShopState, string> = {
  Invited: 'Invited — adding items',
  Pending: 'Waiting to accept',
  Accepted: 'Accepted',
  Declined: 'Declined',
  Withdrawn: 'Withdrew',
  Removed: 'Removed',
  Unknown: 'Unknown',
};
export const shopStateColor: Record<ShopState, string> = {
  Invited: 'blue',
  Pending: 'amber',
  Accepted: 'forest',
  Declined: 'signal',
  Withdrawn: 'signal',
  Removed: 'gray',
  Unknown: 'gray',
};
export const pausedReasonLabel: Record<PausedReason, string> = {
  OwnerPaused: 'Paused by the owner.',
  ShopWithdrew: 'A shop withdrew from the bundle.',
  TermsChanged: 'The terms changed and are waiting for the shops to accept again.',
  AdminTakedown: 'Taken down by StyleMint. Only StyleMint can put it back on sale.',
  ItemRemovedFromCatalog: 'One of the products was archived or removed from the catalog.',
};
export const ownerKindLabel: Record<OwnerKind, string> = { Platform: 'StyleMint', Creator: 'Creator', Vendor: 'Shop', Unknown: 'Unknown' };

export interface BundleShop {
  vendorAccountId: string;
  name: string;
  logoUrl?: string | null;
  state: ShopState;
  acceptedTermsVersion: number | null;
  inviteNote?: string | null;
  closeReason?: string | null;
  invitedUtc?: string | null;
  acceptedUtc?: string | null;
  closedUtc?: string | null;
}

export interface BundleItem {
  id: string;
  productId: string;
  vendorAccountId: string;
  title: string;
  thumbnailUrl: string | null;
  quantity: number;
  note?: string | null;
  sortOrder?: number;
  listUnitPrice: number;
  bundleUnitPrice: number;
  /** Creator-owned bundles: the partnership rate snapshotted when the shop accepted (percent, 8 = 8 %). */
  commissionRatePercent?: number | null;
  /** This shop's discount cost per bundle sold (the server fills it for the caller's own items). */
  shopFunds?: number | null;
  available: boolean;
}

export interface BundleTotals {
  listTotal: number;
  bundleTotal: number;
  saving: number;
  currency: string;
}

export interface Bundle {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  ownerKind: OwnerKind;
  ownerAccountId: string;
  ownerName: string | null;
  discountPercent: number;
  state: BundleState;
  termsVersion: number;
  pausedReason: PausedReason | null;
  pausedNote: string | null;
  myRole: MyRole;
  myShopState: ShopState | null;
  /** Optional (mobile changelog item 5): the caller's vendor id and its total discount cost per bundle sold. */
  myVendorAccountId: string | null;
  myShopFunds: number | null;
  shops: BundleShop[];
  items: BundleItem[];
  totals: BundleTotals | null;
  publishedUtc: string | null;
  archivedUtc: string | null;
  updatedUtc: string | null;
  /** Optional: server-computed availability. Absent → computed from the items. */
  isPurchasable?: boolean;
  unavailableReason?: string | null;
}

export interface BundleSummary {
  id: string;
  title: string;
  coverImageUrl: string | null;
  ownerKind: OwnerKind;
  ownerName: string | null;
  discountPercent: number;
  state: BundleState;
  termsVersion: number | null;
  pausedReason: PausedReason | null;
  myRole: MyRole;
  myShopState: ShopState | null;
  itemCount: number | null;
  shopCount: number | null;
  acceptedShopCount: number | null;
  totals: BundleTotals | null;
  isPurchasable?: boolean;
  updatedUtc: string | null;
}

type Raw = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

function normalizeTotals(raw: unknown): BundleTotals | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Raw;
  return { listTotal: num(t.listTotal) ?? 0, bundleTotal: num(t.bundleTotal) ?? 0, saving: num(t.saving) ?? 0, currency: str(t.currency) ?? 'NPR' };
}

export function normalizeShop(raw: Raw): BundleShop {
  return {
    vendorAccountId: String(raw.vendorAccountId ?? ''),
    name: str(raw.name) ?? str(raw.businessName) ?? 'Shop',
    logoUrl: str(raw.logoUrl),
    state: toShopState(raw.state),
    acceptedTermsVersion: num(raw.acceptedTermsVersion),
    inviteNote: str(raw.inviteNote),
    closeReason: str(raw.closeReason),
    invitedUtc: str(raw.invitedUtc),
    acceptedUtc: str(raw.acceptedUtc),
    closedUtc: str(raw.closedUtc),
  };
}

export function normalizeItem(raw: Raw): BundleItem {
  return {
    id: String(raw.id ?? ''),
    productId: String(raw.productId ?? ''),
    vendorAccountId: String(raw.vendorAccountId ?? ''),
    title: str(raw.title) ?? str(raw.productName) ?? 'Product',
    thumbnailUrl: str(raw.thumbnailUrl),
    quantity: num(raw.quantity) ?? 1,
    note: str(raw.note),
    sortOrder: num(raw.sortOrder) ?? undefined,
    listUnitPrice: num(raw.listUnitPrice) ?? 0,
    bundleUnitPrice: num(raw.bundleUnitPrice) ?? 0,
    commissionRatePercent: num(raw.commissionRatePercent),
    shopFunds: num(raw.shopFunds),
    available: raw.available !== false,
  };
}

export function normalizeBundle(raw: unknown): Bundle {
  const b = (raw ?? {}) as Raw;
  return {
    id: String(b.id ?? ''),
    title: str(b.title) ?? '',
    description: str(b.description),
    coverImageUrl: str(b.coverImageUrl),
    ownerKind: toOwnerKind(b.ownerKind),
    ownerAccountId: String(b.ownerAccountId ?? ''),
    ownerName: str(b.ownerName),
    discountPercent: num(b.discountPercent) ?? 0,
    state: toBundleState(b.state),
    termsVersion: num(b.termsVersion) ?? 1,
    pausedReason: toPausedReason(b.pausedReason),
    pausedNote: str(b.pausedNote),
    myRole: toMyRole(b.myRole),
    myShopState: b.myShopState == null ? null : toShopState(b.myShopState),
    myVendorAccountId: str(b.myVendorAccountId),
    myShopFunds: num(b.myShopFunds),
    shops: Array.isArray(b.shops) ? (b.shops as Raw[]).map(normalizeShop) : [],
    items: Array.isArray(b.items) ? (b.items as Raw[]).map(normalizeItem) : [],
    totals: normalizeTotals(b.totals),
    publishedUtc: str(b.publishedUtc),
    archivedUtc: str(b.archivedUtc),
    updatedUtc: str(b.updatedUtc),
    isPurchasable: typeof b.isPurchasable === 'boolean' ? b.isPurchasable : undefined,
    unavailableReason: str(b.unavailableReason),
  };
}

export function normalizeSummary(raw: unknown): BundleSummary {
  const b = (raw ?? {}) as Raw;
  return {
    id: String(b.id ?? ''),
    title: str(b.title) ?? '',
    coverImageUrl: str(b.coverImageUrl),
    ownerKind: toOwnerKind(b.ownerKind),
    ownerName: str(b.ownerName),
    discountPercent: num(b.discountPercent) ?? 0,
    state: toBundleState(b.state),
    termsVersion: num(b.termsVersion),
    pausedReason: toPausedReason(b.pausedReason),
    myRole: toMyRole(b.myRole),
    myShopState: b.myShopState == null ? null : toShopState(b.myShopState),
    itemCount: num(b.itemCount) ?? (Array.isArray(b.items) ? b.items.length : null),
    shopCount: num(b.shopCount) ?? (Array.isArray(b.shops) ? b.shops.length : null),
    acceptedShopCount: num(b.acceptedShopCount),
    totals: normalizeTotals(b.totals),
    isPurchasable: typeof b.isPurchasable === 'boolean' ? b.isPurchasable : undefined,
    updatedUtc: str(b.updatedUtc),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Limits and money (contract §B2, §B7)

export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 2000;
export const COVER_MAX = 500;
export const NOTE_MAX = 140;
export const INVITE_NOTE_MAX = 280;
export const REASON_MAX = 500;
export const MIN_ITEMS = 2;
export const MAX_ITEMS = 12;
export const MAX_SHOPS = 6;
export const MAX_DISCOUNT = 50;
export const MAX_QUANTITY = 5;

/** The server's rounding: round(P × d / 100, 2, AwayFromZero). */
export function unitDiscount(listPrice: number, discountPercent: number): number {
  const raw = (listPrice * discountPercent) / 100;
  const cents = Math.round(Math.abs(raw) * 100 + 1e-9);
  return (Math.sign(raw) * cents) / 100;
}

/** The discounted unit price U = P − unitDiscount. */
export const discountedPrice = (listPrice: number, discountPercent: number) => Math.round((listPrice - unitDiscount(listPrice, discountPercent)) * 100) / 100;

/** Totals for a draft (create form preview); the server is authoritative once saved. */
export function previewTotals(lines: { price: number; quantity: number }[], discountPercent: number) {
  let listTotal = 0;
  let bundleTotal = 0;
  for (const l of lines) {
    listTotal += l.price * l.quantity;
    bundleTotal += discountedPrice(l.price, discountPercent) * l.quantity;
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return { listTotal: r(listTotal), bundleTotal: r(bundleTotal), saving: r(listTotal - bundleTotal) };
}

/** What one shop gives up per bundle sold: the server's `shopFunds`, else (list − bundle) × quantity. */
export function shopFunding(items: BundleItem[], vendorAccountId: string | null | undefined): number {
  if (!vendorAccountId) return 0;
  const total = items
    .filter((i) => i.vendorAccountId === vendorAccountId)
    .reduce((sum, i) => sum + (i.shopFunds ?? (i.listUnitPrice - i.bundleUnitPrice) * i.quantity), 0);
  return Math.round(total * 100) / 100;
}

export function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`;
}

export interface BundleTextInput {
  title: string;
  description: string;
  coverImageUrl: string;
  discountPercent: number | string | null;
}

/** Client-side checks that mirror the server limits. Returns the first problem, or null. */
export function validateBundleText(v: BundleTextInput): string | null {
  const title = v.title.trim();
  if (!title) return 'Give the bundle a title.';
  if (title.length > TITLE_MAX) return `Keep the title to ${TITLE_MAX} characters.`;
  if (v.description.trim().length > DESCRIPTION_MAX) return `Keep the description to ${DESCRIPTION_MAX} characters.`;
  const cover = v.coverImageUrl.trim();
  if (cover && !/^https:\/\/\S+$/i.test(cover)) return 'The cover image must be an https:// link.';
  if (cover.length > COVER_MAX) return `The cover link is too long (${COVER_MAX} characters at most).`;
  const d = typeof v.discountPercent === 'number' ? v.discountPercent : Number(v.discountPercent);
  if (v.discountPercent === null || v.discountPercent === '' || !Number.isFinite(d)) return 'Enter a discount from 0 to 50 %.';
  if (d < 0 || d > MAX_DISCOUNT) return `The discount must be between 0 and ${MAX_DISCOUNT} %.`;
  if (Math.round(d * 100) !== d * 100) return 'Use at most 2 decimals for the discount.';
  return null;
}

export function validateQuantity(q: number | string | null | undefined): string | null {
  const n = typeof q === 'number' ? q : Number(q);
  if (!Number.isInteger(n) || n < 1 || n > MAX_QUANTITY) return `Quantity must be 1 to ${MAX_QUANTITY}.`;
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// What the signed-in seller may do (contract §B3)

export function acceptedCount(b: Pick<Bundle, 'shops' | 'termsVersion'>): number {
  return b.shops.filter((s) => s.state === 'Accepted' && (s.acceptedTermsVersion == null || s.acceptedTermsVersion === b.termsVersion)).length;
}

/** Shops that still take part (not declined, withdrawn or removed). */
export function activeShops(b: Pick<Bundle, 'shops'>): BundleShop[] {
  return b.shops.filter((s) => s.state === 'Invited' || s.state === 'Pending' || s.state === 'Accepted');
}

export function allAccepted(b: Pick<Bundle, 'shops' | 'termsVersion'>): boolean {
  const open = activeShops(b);
  return open.length > 0 && open.every((s) => s.state === 'Accepted' && (s.acceptedTermsVersion == null || s.acceptedTermsVersion === b.termsVersion));
}

/** Why the owner cannot send the draft to the shops yet, or null when it can go. */
export function submitBlocker(b: Pick<Bundle, 'items' | 'shops'>): string | null {
  if (b.items.length < MIN_ITEMS) return `Add at least ${MIN_ITEMS} items (${b.items.length} so far).`;
  if (b.items.length > MAX_ITEMS) return `A bundle holds at most ${MAX_ITEMS} items.`;
  if (activeShops(b).length > MAX_SHOPS) return `A bundle can include at most ${MAX_SHOPS} shops.`;
  return null;
}

/** Why a paused bundle cannot be resumed by its owner, or null. */
export function resumeBlocker(b: Pick<Bundle, 'state' | 'pausedReason' | 'shops' | 'termsVersion'>): string | null {
  if (b.state !== 'Paused') return 'Only a paused bundle can be resumed.';
  if (b.pausedReason === 'AdminTakedown') return 'StyleMint took this bundle down; only StyleMint can put it back on sale.';
  if (!allAccepted(b)) return 'Every shop must accept the current terms before the bundle can go back on sale.';
  return null;
}

export function bundlePermissions(b: Bundle, me: string | null | undefined) {
  const owner = b.myRole === 'Owner';
  const open = b.state !== 'Archived' && b.state !== 'Unknown';
  const vendorOwned = b.ownerKind === 'Vendor';
  const myState = b.myShopState;
  const inBundle = myState === 'Invited' || myState === 'Pending' || myState === 'Accepted';
  const shopCanEditOwn = !owner && vendorOwned && open && inBundle;
  return {
    owner,
    open,
    canEdit: owner && open,
    canAddItems: open && b.items.length < MAX_ITEMS && (owner || shopCanEditOwn),
    canEditItem: (i: BundleItem) => open && (owner || (shopCanEditOwn && i.vendorAccountId === me)),
    canInvite: owner && open && vendorOwned && activeShops(b).length < MAX_SHOPS,
    canRemoveShop: (s: BundleShop) => owner && open && s.vendorAccountId !== me && s.state !== 'Removed',
    canSubmit: owner && b.state === 'Draft',
    canPause: owner && b.state === 'Live',
    canResume: owner && b.state === 'Paused' && b.pausedReason !== 'AdminTakedown',
    canArchive: owner && open,
    /** Owners of vendor bundles are shops too: they may need to re-accept after another shop changed its items. */
    canAccept: myState === 'Pending' && open,
    canDecline: myState === 'Pending' && open && !owner,
    canWithdraw: myState === 'Accepted' && open && !owner,
    /** An invited shop of a vendor bundle: it adds its own products before it can accept. */
    mustAddItems: !owner && vendorOwned && myState === 'Invited',
    canShare: b.state === 'Live' || b.state === 'Paused',
  };
}

/**
 * The warning shown before an items / discount change: the terms version goes up and every other shop must accept
 * again; a live bundle is off sale until they do. Null for a draft (nobody has accepted anything yet).
 */
export function termsChangeWarning(b: Pick<Bundle, 'state' | 'termsVersion' | 'shops'>, me: string | null | undefined): string | null {
  if (b.state === 'Draft' || b.state === 'Archived') return null;
  const others = activeShops(b).filter((s) => s.vendorAccountId !== me).length;
  const offSale = b.state === 'Live' ? ' It goes off sale until they do.' : '';
  if (others === 0) return `This changes the terms (version ${b.termsVersion} → ${b.termsVersion + 1}).${offSale}`;
  return `This changes the terms (version ${b.termsVersion} → ${b.termsVersion + 1}). ${others === 1 ? 'The other shop must' : `All ${others} other shops must`} accept again.${offSale}`;
}

/** Live and every item in stock. Uses the server's flag when it sends one. */
export function isPurchasable(b: Pick<Bundle, 'state' | 'items' | 'isPurchasable'>): boolean {
  if (typeof b.isPurchasable === 'boolean') return b.isPurchasable;
  return b.state === 'Live' && b.items.every((i) => i.available);
}

/** The public share link (served by the web shop, contract §A1). */
export function shareUrl(id: string, origin: string = typeof window !== 'undefined' ? window.location.origin : ''): string {
  return `${origin}/shop/b/${encodeURIComponent(id)}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Errors (contract §B5)

const ERROR_TEXT: Record<string, string> = {
  bundle_not_editable: 'This bundle can no longer be changed in its current state.',
  bundle_terms_changed: 'The terms changed while you were looking. Check the new terms and accept again.',
  bundle_item_not_partner: 'You can only add products from shops you have an active partnership with.',
  bundle_item_not_own: 'You can only add your own products to this bundle.',
  bundle_limits: `A bundle holds ${MIN_ITEMS}–${MAX_ITEMS} items from up to ${MAX_SHOPS} shops, a discount of 0–${MAX_DISCOUNT} % and up to ${MAX_QUANTITY} of each item.`,
  bundle_not_purchasable: 'The bundle cannot be bought right now.',
  bundle_not_found: 'This bundle no longer exists.',
  state_concurrency_conflict: 'Someone changed this bundle at the same moment. Reload and try again.',
};

const codeKey = (code: string) => code.replace(/[.-]/g, '_').toLowerCase();

export function isBundleError(error: unknown, code: string): boolean {
  return error instanceof ApiError && !!error.code && codeKey(error.code) === codeKey(code);
}

export function bundleErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code) {
    const text = ERROR_TEXT[codeKey(error.code)];
    if (text) return text;
  }
  return messageOf(error);
}

// ---------------------------------------------------------------------------------------------------------------------
// Admin

export const TAKEDOWN_NOTE_MIN = 3;
export const validTakedownNote = (note: string) => {
  const n = note.trim();
  return n.length >= TAKEDOWN_NOTE_MIN && n.length <= REASON_MAX;
};

/** What the console offers on a bundle; `manage` = the `manageBundles` capability. */
export function adminBundleActions(b: Bundle, manage: boolean) {
  const platform = b.ownerKind === 'Platform';
  const open = b.state !== 'Archived' && b.state !== 'Unknown';
  const takenDown = b.state === 'Paused' && b.pausedReason === 'AdminTakedown';
  return {
    platform,
    canEdit: manage && platform && open,
    canSubmit: manage && platform && b.state === 'Draft',
    canPause: manage && platform && b.state === 'Live',
    canTakedown: manage && (b.state === 'Live' || b.state === 'PendingAcceptance' || (b.state === 'Paused' && !takenDown)),
    canResume: manage && b.state === 'Paused' && (takenDown || (platform && allAccepted(b))),
    canArchive: manage && open,
  };
}

export const OWNER_KIND_OPTIONS = (['Platform', 'Creator', 'Vendor'] as OwnerKind[]).map((k) => ({ value: k, label: ownerKindLabel[k] }));
export const STATE_OPTIONS = (['Draft', 'PendingAcceptance', 'Live', 'Paused', 'Archived'] as BundleState[]).map((s) => ({ value: s, label: stateLabel[s] }));

export interface CreateBundleBody {
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  discountPercent: number;
  items: { productId: string; quantity: number; note?: string | null }[];
}

export interface BundleQuery {
  q?: string;
  state?: string;
  ownerKind?: string;
  cursor?: string | null;
  page: number;
  pageSize: number;
}

const enc = encodeURIComponent;
const base = '/v1/admin/bundles';
const asBundle = (r: unknown) => (r && typeof r === 'object' && 'id' in r ? normalizeBundle(r) : undefined);

export const bundlesAdminApi = {
  list: async (f: BundleQuery, signal?: AbortSignal): Promise<Page<BundleSummary>> => {
    const page = toPage<unknown>(
      await http.get(
        base,
        { q: f.q || undefined, state: f.state || undefined, ownerKind: f.ownerKind || undefined, cursor: f.cursor ?? undefined, pageSize: Math.min(100, f.pageSize) },
        signal,
      ),
      f.page,
      f.pageSize,
    );
    return { ...page, items: page.items.map(normalizeSummary) };
  },
  get: async (id: string, signal?: AbortSignal) => normalizeBundle(await http.get<unknown>(`${base}/${enc(id)}`, undefined, signal)),
  create: async (body: CreateBundleBody) => normalizeBundle(await http.post<unknown>(base, body)),
  update: async (id: string, body: { title?: string; description?: string | null; coverImageUrl?: string | null; discountPercent?: number }) =>
    asBundle(await http.patch<unknown>(`${base}/${enc(id)}`, body)),
  addItem: async (id: string, body: { productId: string; quantity: number; note?: string | null }) => asBundle(await http.post<unknown>(`${base}/${enc(id)}/items`, body)),
  removeItem: async (id: string, itemId: string) => asBundle(await http.del<unknown>(`${base}/${enc(id)}/items/${enc(itemId)}`)),
  submit: async (id: string) => asBundle(await http.post<unknown>(`${base}/${enc(id)}/submit`)),
  pause: async (id: string) => asBundle(await http.post<unknown>(`${base}/${enc(id)}/pause`)),
  resume: async (id: string) => asBundle(await http.post<unknown>(`${base}/${enc(id)}/resume`)),
  archive: async (id: string) => asBundle(await http.post<unknown>(`${base}/${enc(id)}/archive`)),
  takedown: async (id: string, note: string) => asBundle(await http.post<unknown>(`${base}/${enc(id)}/takedown`, { note })),
};
