import { api, ApiError } from '../../api/client';
import type { PagedResult } from '../../api/paging';
import type { Money } from '../../lib/format';

/**
 * Vendor products (StyleMint.Modules.Catalog VendorProductsController). Enums are INTEGERS on the
 * wire, except EMI `approvalMode` ("Manual"). Prices are flat numbers + currency, not Money.
 */

export const ProductState = { Draft: 1, Active: 2, OutOfStock: 3, Archived: 4, Suspended: 5 } as const;
export const productStateLabel: Record<number, string> = {
  1: 'Draft',
  2: 'Live',
  3: 'Out of stock',
  4: 'Archived',
  5: 'Suspended',
};
export const productStateColor: Record<number, string> = { 1: 'gray', 2: 'forest', 3: 'amber', 4: 'slate', 5: 'signal' };

export const ProductKind = { Physical: 1, Digital: 2, Service: 3, Subscription: 4, Bundle: 5 } as const;
export const BillingCadence = { OneTime: 1, Weekly: 2, Monthly: 3, Quarterly: 4, Annual: 5 } as const;
export const ShippingOptionKind = { Standard: 1, Express: 2, Pickup: 3 } as const;
export const shippingKindLabel: Record<number, string> = { 1: 'Standard delivery', 2: 'Express delivery', 3: 'Store pickup' };
export const ProductOptionKind = { Size: 1, Colour: 2, Material: 3, Style: 4, Other: 99 } as const;
export const AttributeDataType = { Text: 1, Number: 2, Boolean: 3, Enumeration: 4 } as const;
export const attributeUnitLabel: Record<number, string> = {
  0: '',
  1: 'mm',
  2: 'cm',
  3: 'm',
  4: 'g',
  5: 'kg',
  6: 'ml',
  7: 'L',
  8: 'N·m',
  9: '%',
  10: 'months',
  11: 'years',
  12: 'W',
  13: 'V',
  14: 'pcs',
};

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  isDefault: boolean;
  priceAmount: number;
  priceCurrency: string;
  costPriceAmount: number;
  costPriceCurrency: string;
  trackInventory: boolean;
  allowOverselling: boolean;
  quantityOnHand: number;
  productKind: number;
  billingCadence: number;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  optionValueIds: string[];
  optionLabel: string | null;
}

export interface ProductOption {
  id: string;
  name: string;
  kind: number;
  sortOrder: number;
  values: { id: string; value: string; sortOrder: number; swatchHex: string | null }[];
}

export interface ProductImage {
  id: string;
  cdnUrl: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ShippingOption {
  id: string;
  kind: number;
  feeAmount: number;
  feeCurrency: string;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isEnabled: boolean;
}

export interface Product {
  id: string;
  vendorAccountId: string;
  categoryId: string;
  name: string;
  shortDescription: string;
  longDescriptionMarkdown: string;
  shipsFromAddressId: string | null;
  processingTimeDays: number;
  state: number;
  wizardStepReached: number;
  averageRating: number;
  reviewCount: number;
  createdUtc: string;
  updatedUtc: string;
  variants: ProductVariant[];
  options: ProductOption[];
  images: ProductImage[];
  video: { cdnUrl: string; durationSeconds: number; posterCdnUrl: string | null } | null;
  shippingOptions: ShippingOption[];
  isInStock: boolean;
  defaultVariantId: string | null;
}

export interface Category {
  id: string;
  parentCategoryId: string | null;
  slug: string;
  nameEn: string;
  displayOrder: number;
  isGated: boolean;
  isActive: boolean;
}

export interface BasicRequest {
  categoryId: string;
  name: string;
  shortDescription: string;
  longDescriptionMarkdown: string;
}

export interface MediaRequest {
  images: { cdnUrl: string; sortOrder: number; isPrimary: boolean }[];
  video?: { cdnUrl: string; durationSeconds: number; posterCdnUrl?: string | null } | null;
}

export interface OptionInput {
  name: string;
  kind: number;
  sortOrder: number;
  values: { value: string; sortOrder: number; swatchHex?: string | null }[];
}

export interface VariantInput {
  sku: string;
  isDefault: boolean;
  priceAmount?: number | null;
  costPriceAmount?: number | null;
  quantityOnHand?: number | null;
  optionValues: { option: string; value: string }[];
}

export interface PricingRequest {
  sku: string;
  priceAmount: number;
  priceCurrency: string;
  costPriceAmount: number;
  costPriceCurrency: string;
  trackInventory: boolean;
  allowOverselling: boolean;
  quantityOnHand: number;
  productKind: number;
  billingCadence: number;
  options?: OptionInput[] | null;
  variants?: VariantInput[] | null;
}

export interface ShippingRequest {
  processingTimeDays: number;
  shipsFromAddressId?: string | null;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  shippingOptions: { kind: number; feeAmount: number; feeCurrency: string; estimatedDaysMin: number; estimatedDaysMax: number }[];
}

export interface AttributeDefinition {
  id: string;
  categoryId: string | null;
  key: string;
  label: string;
  description: string | null;
  dataType: number;
  unit: number;
  allowedValues: string[];
  minNumber: number | null;
  maxNumber: number | null;
  isActive: boolean;
  sortOrder: number;
}

export interface AttributeValue {
  id: string;
  definitionId: string;
  key: string;
  label: string;
  dataType: number;
  unit: number;
  textValue: string | null;
  numberValue: number | null;
  booleanValue: boolean | null;
}

export interface AttributeSheet {
  productId: string;
  categoryId: string;
  applicableDefinitions: AttributeDefinition[];
  values: AttributeValue[];
}

export interface AiDescription {
  title: string;
  description: string;
  keyFeatures: string[];
  suggestedHashtags: string[];
}

export interface EmiQuote {
  variantId: string;
  productId: string;
  price: Money;
  downPaymentPercent: number;
  downPayment: Money;
  financedAmount: Money;
  tenureMonths: number;
  monthlyInstallment: Money;
  lastInstallment: Money;
  interestTotal: Money;
  totalPayable: Money;
  schedule: { number: number; amount: Money }[];
}

export interface EmiTerms {
  productId: string;
  productName: string;
  enabled: boolean;
  minDownPaymentPercent: number;
  effectiveMinDownPaymentPercent: number;
  tenures: number[];
  interestRatePercentMonthly: number;
  approvalMode: 'Manual';
  eligibleVariantCount: number;
  minimumPrice: Money;
  sampleQuote: EmiQuote | null;
  updatedUtc: string | null;
}

export interface EmiSettings {
  exposureLimit: Money | null;
  maxExposureLimit: Money;
}

export interface StoreSnapshot {
  activeProductCount: number;
  outOfStockProductCount: number;
  lowStockVariantCount: number;
  totalUnitsOnHand: number;
  activeFlashSaleCount: number;
  unitsSoldLast7Days: number;
  generatedUtc: string;
}

const base = '/v1/vendor/products';

export const productsApi = {
  list: (state: number | null, cursor: string | null, pageSize = 25) =>
    api.get<PagedResult<Product>>(base, { state: state ?? undefined, cursor: cursor ?? undefined, pageSize }),
  detail: (id: string) => api.get<Product>(`${base}/${id}`),
  create: (body: BasicRequest) => api.post<Product>(base, body),
  step1: (id: string, body: BasicRequest) => api.patch<Product>(`${base}/${id}/step-1`, body),
  basic: (id: string, body: BasicRequest) => api.patch<Product>(`${base}/${id}/details/basic`, body),
  step2: (id: string, body: MediaRequest) => api.patch<Product>(`${base}/${id}/step-2`, body),
  images: (id: string, body: MediaRequest) => api.patch<Product>(`${base}/${id}/images`, body),
  step3: (id: string, body: PricingRequest) => api.patch<Product>(`${base}/${id}/step-3`, body),
  pricing: (id: string, body: PricingRequest) => api.patch<Product>(`${base}/${id}/details/pricing`, body),
  step4: (id: string, body: ShippingRequest) => api.patch<Product>(`${base}/${id}/step-4`, body),
  shipping: (id: string, body: ShippingRequest) => api.patch<Product>(`${base}/${id}/details/shipping`, body),
  publish: (id: string) => api.post<Product>(`${base}/${id}/publish`),
  archive: (id: string) => api.post<Product>(`${base}/${id}/archive`),
  stock: (id: string, adjustments: { variantId: string; quantity: number }[], alertCustomersOnRestock = true) =>
    api.patch<Product>(`${base}/${id}/stock`, { adjustments, alertCustomersOnRestock }),
  aiDescribe: (id: string, body: { shorthandNotes?: string | null; imageUrls?: string[] | null }) =>
    api.post<AiDescription>(`${base}/${id}/ai-describe`, body),
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<{ url: string }>(`${base}/images`, form);
  },

  categories: () => api.get<Category[]>('/v1/public/categories/tree', undefined, { anonymous: true }),

  attributes: (id: string) => api.get<AttributeSheet>(`${base}/${id}/attributes`),
  setAttribute: (id: string, key: string, value: { textValue?: string | null; numberValue?: number | null; booleanValue?: boolean | null }) =>
    api.put<AttributeValue>(`${base}/${id}/attributes/${encodeURIComponent(key)}`, value),
  clearAttribute: (id: string, key: string) => api.del<boolean>(`${base}/${id}/attributes/${encodeURIComponent(key)}`),

  emiTerms: (id: string) => api.get<EmiTerms>(`${base}/${id}/emi-terms`),
  putEmiTerms: (id: string, body: { enabled: boolean; minDownPaymentPercent: number; tenures: number[] }) =>
    api.put<EmiTerms>(`${base}/${id}/emi-terms`, { ...body, interestRatePercentMonthly: 0, approvalMode: 'Manual' }),
  emiProducts: () => api.get<EmiTerms[]>('/v1/vendor/emi/products'),
  emiSettings: () => api.get<EmiSettings>('/v1/vendor/emi/settings'),
  putEmiSettings: (exposureLimit: Money | null) => api.put<EmiSettings>('/v1/vendor/emi/settings', { exposureLimit }),

  storeSnapshot: () => api.get<StoreSnapshot>('/v1/vendor/store/digital-twin'),
};

/** A friendlier sentence for the EMI error codes. */
export function emiErrorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Could not save EMI terms.';
  switch (e.code) {
    case 'emi_terms.price_below_minimum':
      return 'EMI needs at least one variant priced Rs 20,000 or more.';
    case 'emi_terms.down_payment_out_of_range':
      return 'The minimum down payment must be between 20% and 90%.';
    case 'emi_terms.invalid_tenure':
      return 'Choose at least one tenure: 3, 6, 9 or 12 months.';
    case 'emi_terms.subscription_not_eligible':
      return 'Subscriptions cannot be sold on EMI.';
    case 'emi_settings.exposure_above_maximum':
      return 'That is above the maximum StyleMint allows for your shop.';
    default:
      return e.message;
  }
}

/** Client-side EMI arithmetic (contract: must match the backend). */
export function emiInstallment(price: number, downPct: number, months: number) {
  const downPayment = Math.ceil((price * downPct) / 100);
  const financed = price - downPayment;
  const installment = Math.ceil(financed / months);
  const last = financed - installment * (months - 1);
  return { downPayment, financed, installment, last };
}

export const roundUpTo5 = (n: number) => Math.ceil(n / 5) * 5;
