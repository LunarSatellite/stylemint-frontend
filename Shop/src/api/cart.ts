import { api } from './client';

/** Server cart (signed in). Every mutation answers with the full CartViewDto. */

export interface CartLine {
  lineId: string;
  productId: string;
  productVariantId: string;
  quantity: number;
  unitPriceAmount: number;
  unitPriceCurrency: string;
  lineSubtotalAmount: number;
  productTitleSnapshot: string;
  variantLabelSnapshot: string | null;
  optionLabel: string | null;
  thumbnailUrlSnapshot: string | null;
  creatorHandleSnapshot?: string | null;
  reelTagContextId?: string | null;
  /** Contract B8 (null on non-bundle lines / before the bundles backend ships). */
  bundleId?: string | null;
  bundleGroupId?: string | null;
  bundleListUnitPrice?: number | null;
  bundleTitleSnapshot?: string | null;
  /** Not on today's DTO; used when present. */
  vendorAccountId?: string | null;
}

export interface CartBundleGroup {
  groupId: string;
  bundleId: string;
  title: string;
  quantity: number;
  listTotal: number;
  total: number;
  saving: number;
  isPurchasable: boolean;
  unavailableReason: string | null;
}

export interface CartNotice {
  lineId?: string | null;
  productTitleSnapshot?: string | null;
  kind?: number;
  code?: string;
  bundleTitle?: string;
}

export interface CartView {
  lines: CartLine[];
  itemCount: number;
  subtotalAmount: number;
  subtotalCurrency: string;
  shippingAmount: number;
  discountAmount: number;
  grandTotalAmount: number;
  grandTotalCurrency: string;
  notices?: CartNotice[];
  bundles?: CartBundleGroup[];
}

export interface AddLineBody {
  productId: string;
  productVariantId?: string;
  quantity: number;
  reelTagContextId?: string;
  affiliateCode?: string;
}

export interface AddBundleBody {
  bundleId: string;
  termsVersion: number;
  quantity: number;
  taggedBundleId?: string;
  affiliateCode?: string;
  variants: { bundleItemId: string; productVariantId: string }[];
}

export const cartApi = {
  get: () => api.get<CartView>('/v1/cart'),
  addLine: (body: AddLineBody, idempotencyKey?: string) => api.post<CartView>('/v1/cart/lines', body, { idempotencyKey }),
  setQuantity: (lineId: string, quantity: number) => api.patch<CartView>(`/v1/cart/lines/${lineId}`, { quantity }),
  removeLine: (lineId: string) => api.del<CartView>(`/v1/cart/lines/${lineId}`),
  addBundle: (body: AddBundleBody, idempotencyKey?: string) => api.post<CartView>('/v1/cart/bundles', body, { idempotencyKey }),
  setBundleQuantity: (groupId: string, quantity: number) => api.patch<CartView>(`/v1/cart/bundles/${groupId}`, { quantity }),
  removeBundle: (groupId: string) => api.del<CartView>(`/v1/cart/bundles/${groupId}`),
  unbundle: (groupId: string) => api.post<CartView>(`/v1/cart/bundles/${groupId}/unbundle`),
};
