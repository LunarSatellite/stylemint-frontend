/**
 * Cross-vendor products - `GET /v1/admin/products` and moderation (wt/admin-api-contract.md, backend branch
 * feat/admin-api-gaps). Unlike older admin endpoints these return enum NAMES as strings and money as
 * `{ amount, currency }`.
 */
import { http } from './client';
import { toPage, type Page } from './paging';

export interface Money {
  amount: number;
  currency: string;
}

export type ProductStatus = 'Draft' | 'Active' | 'OutOfStock' | 'Archived' | 'Suspended';

export const PRODUCT_STATUS_LABEL: Record<string, string> = {
  Draft: 'Draft',
  Active: 'Active',
  OutOfStock: 'Out of stock',
  Archived: 'Archived',
  Suspended: 'Suspended',
};
export const PRODUCT_STATUS_TONE: Record<string, string> = { Draft: 'gray', Active: 'forest', OutOfStock: 'amber', Archived: 'gray', Suspended: 'signal' };

/** Query values for `status` (snake case; the server accepts either). */
export const PRODUCT_STATUS_FILTER = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'out_of_stock', label: 'Out of stock' },
  { value: 'archived', label: 'Archived' },
  { value: 'suspended', label: 'Suspended' },
];

export const PRODUCT_SORT = [
  { value: 'updated_desc', label: 'Recently updated' },
  { value: 'created_desc', label: 'Newest' },
  { value: 'created_asc', label: 'Oldest' },
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
  { value: 'units_sold_desc', label: 'Best selling' },
  { value: 'rating_desc', label: 'Best rated' },
];

export const TAKEDOWN_REASONS = [
  { value: 'COUNTERFEIT_PRODUCT', label: 'Counterfeit product' },
  { value: 'MISLEADING', label: 'Misleading listing' },
  { value: 'NUDITY_OR_SEXUAL', label: 'Nudity or sexual content' },
  { value: 'HATE_OR_HARASSMENT', label: 'Hate or harassment' },
  { value: 'VIOLENCE', label: 'Violence' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'OTHER', label: 'Other' },
];

export interface Takedown {
  atUtc: string;
  reason: string;
  reasonCode: string | null;
  byAdminId: string;
}

export interface AdminProduct {
  id: string;
  name: string;
  vendorAccountId: string;
  vendorName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  status: ProductStatus | string;
  thumbnailUrl: string | null;
  price: { min: number; max: number; currency: string } | null;
  stock: { totalOnHand: number; variantCount: number; outOfStock: boolean } | null;
  unitsSold: number | null;
  unitsSold30d: number | null;
  averageRating: number | null;
  reviewCount: number | null;
  hasReel: boolean | null;
  restrictionLevel: string | null;
  flagged: boolean;
  openModerationItems: number;
  unpublished: Takedown | null;
  createdUtc: string;
  updatedUtc: string;
}

export interface AdminProductDetail extends AdminProduct {
  shortDescription: string | null;
  longDescriptionMarkdown: string | null;
  processingTimeDays: number | null;
  wizardStepReached: number | null;
  images: { id: string; url: string; sortOrder: number }[];
  variants: { id: string; sku: string; isDefault: boolean; price: Money; trackInventory: boolean; allowOverselling: boolean; quantityOnHand: number }[];
  moderation: {
    openItems: { moderationItemId: string; source: string; reportReasonCode: string | null; state: string; submittedUtc: string }[];
    history: { action: string; reason: string | null; reasonCode: string | null; byAdminId: string; atUtc: string }[];
  } | null;
}

export interface ProductFilter {
  search?: string;
  vendorAccountId?: string;
  status?: string;
  flagged?: boolean;
  unpublished?: boolean;
  outOfStock?: boolean;
  sort?: string;
  page: number;
  pageSize: number;
}

const enc = encodeURIComponent;

export const productsApi = {
  list: async (f: ProductFilter, signal?: AbortSignal): Promise<Page<AdminProduct>> =>
    toPage<AdminProduct>(
      await http.get(
        '/v1/admin/products',
        {
          search: f.search || undefined,
          vendorAccountId: f.vendorAccountId || undefined,
          status: f.status || undefined,
          flagged: f.flagged || undefined,
          unpublished: f.unpublished || undefined,
          outOfStock: f.outOfStock || undefined,
          sort: f.sort || undefined,
          pageNumber: f.page,
          pageSize: Math.min(100, f.pageSize),
        },
        signal,
      ),
      f.page,
      f.pageSize,
    ),
  detail: (id: string, signal?: AbortSignal) => http.get<AdminProductDetail>(`/v1/admin/products/${enc(id)}`, undefined, signal),
  /** Takes the listing down everywhere; the vendor is told the reason. */
  unpublish: (id: string, reason: string, reasonCode: string | null) => http.post<AdminProductDetail>(`/v1/admin/products/${enc(id)}/unpublish`, { reason, reasonCode }),
  restore: (id: string, note: string | null) => http.post<AdminProductDetail>(`/v1/admin/products/${enc(id)}/restore`, { note }),
};
