import { api } from './client';

/** Public (anonymous) catalog reads. Wire format: camelCase, enums as integers. */

export interface PagedResult<T> {
  items: T[];
  totalCount?: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ProductImage {
  id: string;
  cdnUrl: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductVariant {
  id: string;
  isDefault: boolean;
  priceAmount: number;
  priceCurrency: string;
  trackInventory: boolean;
  allowOverselling: boolean;
  quantityOnHand: number;
  optionLabel: string | null;
}

export interface FlashSale {
  originalPrice: number;
  salePrice: number;
  currency: string;
  endsUtc: string;
}

/** ProductDto (public detail and card projection). */
export interface Product {
  id: string;
  vendorAccountId: string;
  vendorDisplayName?: string | null;
  vendorAvatarUrl?: string | null;
  name: string;
  shortDescription?: string | null;
  longDescriptionMarkdown?: string | null;
  /** 1 Draft, 2 Active, 3 OutOfStock, 4 Archived, 5 Suspended */
  state: number;
  averageRating?: number | null;
  reviewCount?: number;
  variants: ProductVariant[];
  images: ProductImage[];
  video?: { cdnUrl: string; posterCdnUrl?: string | null } | null;
  activeFlashSale?: FlashSale | null;
  requiresOptionSelection?: boolean;
  defaultVariantId?: string | null;
  isInStock?: boolean;
  isService?: boolean;
  processingTimeDays?: number | null;
}

export interface TaggedProduct {
  id: string;
  productId: string;
  productName: string;
  productPrimaryImageUrl: string | null;
  productPriceSnapshotAmount: number;
  productPriceSnapshotCurrency: string;
  vendorAccountId: string;
  vendorDisplayName: string | null;
  overlayPositionX?: number;
  overlayPositionY?: number;
  isService?: boolean;
  addableToCart?: boolean;
}

export interface Reel {
  id: string;
  creatorAccountId: string;
  caption: string | null;
  thumbnailCdnUrl: string | null;
  videoCdnUrl: string | null;
  creatorDisplayName: string | null;
  creatorAvatarUrl: string | null;
  taggedProducts: TaggedProduct[];
}

export interface BundleCard {
  id: string;
  title: string;
  coverImageUrl: string | null;
  discountPercent: number;
  isPurchasable?: boolean;
  totals?: BundleTotals;
}

export interface TaggedBundle {
  taggedBundleId: string;
  x: number;
  y: number;
  bundle: BundleCard;
}

export interface BrandProfile {
  accountId: string;
  businessName: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  tagline: string | null;
  description: string | null;
  isVerified: boolean;
  returnPolicySummary: string | null;
}

export interface BundleVariant {
  id: string;
  label: string | null;
  price: number;
  inStock: boolean;
}

export interface BundleItem {
  /** bundleItemId */
  id: string;
  productId: string;
  quantity: number;
  note: string | null;
  listUnitPrice: number;
  bundleUnitPrice: number;
  product: {
    id: string;
    name?: string;
    title?: string;
    thumbnailUrl?: string | null;
    primaryImageUrl?: string | null;
    vendorAccountId?: string;
    vendorDisplayName?: string | null;
  };
  variants: BundleVariant[];
}

export interface BundleTotals {
  listTotal: number;
  bundleTotal: number;
  saving: number;
  currency: string;
}

/** BundleDetailDto (contract B6). */
export interface BundleDetail {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  discountPercent: number;
  termsVersion: number;
  isPurchasable: boolean;
  unavailableReason: 'paused' | 'item_out_of_stock' | 'item_unavailable' | null;
  curator: { kind: string | number; accountId: string; name: string; handle?: string | null; avatarUrl?: string | null } | null;
  items: BundleItem[];
  totals: BundleTotals;
}

export const catalogApi = {
  product: (id: string) => api.get<Product>(`/v1/public/products/${id}`, undefined, { anonymous: true }),
  reel: (id: string) => api.get<Reel>(`/v1/public/reels/${id}`, undefined, { anonymous: true }),
  reelBundles: (id: string) => api.get<TaggedBundle[]>(`/v1/public/reels/${id}/tagged-bundles`, undefined, { anonymous: true }),
  brand: (vendorAccountId: string) => api.get<BrandProfile>(`/v1/public/brands/${vendorAccountId}`, undefined, { anonymous: true }),
  vendorProducts: (vendorAccountId: string, cursor?: string | null) =>
    api.get<PagedResult<Product>>(`/v1/public/vendors/${vendorAccountId}/products`, { cursor, pageSize: 20 }, { anonymous: true }),
  bundle: (id: string) => api.get<BundleDetail>(`/v1/public/bundles/${id}`, undefined, { anonymous: true }),
  vendorBundles: (vendorAccountId: string) =>
    api.get<PagedResult<BundleCard>>('/v1/public/bundles', { vendorAccountId }, { anonymous: true }),
  productView: (id: string, reelId?: string) =>
    api.post<void>(`/v1/public/products/${id}/views`, reelId ? { reelId } : {}, { anonymous: true, idempotencyKey: false }),
};

// ---------------------------------------------------------------- helpers

export function primaryImage(p: Pick<Product, 'images'> | undefined): string | null {
  if (!p?.images?.length) return null;
  return ([...p.images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder)[0]?.cdnUrl) ?? null;
}

export function variantInStock(v: ProductVariant): boolean {
  return !v.trackInventory || v.allowOverselling || v.quantityOnHand > 0;
}

export function defaultVariant(p: Product): ProductVariant | null {
  if (!p.variants?.length) return null;
  return p.variants.find((v) => v.id === p.defaultVariantId) ?? p.variants.find((v) => v.isDefault) ?? p.variants[0];
}

/** Contract B7: unitDiscount = round(P × d / 100, 2, AwayFromZero); U = P − unitDiscount. */
export function bundleUnitPrice(price: number, discountPercent: number): number {
  const raw = (price * discountPercent) / 100;
  const discount = Math.sign(raw) * Math.round(Math.abs(raw) * 100 + 1e-9) / 100;
  return Math.round((price - discount) * 100) / 100;
}

export function bundleItemName(item: BundleItem): string {
  return item.product?.name ?? item.product?.title ?? 'Item';
}
