import { z } from 'zod';
import { ProductOptionKind, type OptionInput, type PricingRequest, type ShippingRequest, type VariantInput } from './api';

/**
 * Wizard validation, mirroring the backend's FluentValidation rules (Catalog ViewModels/Vendor) so
 * sellers see the problem before the round trip.
 */

export const basicsSchema = z.object({
  categoryId: z.string({ required_error: 'Choose a category' }).min(1, 'Choose a category'),
  name: z.string().trim().min(1, 'Give your product a name').max(200, 'Keep the name under 200 characters'),
  shortDescription: z
    .string()
    .trim()
    .min(1, 'Add a one-line summary')
    .max(280, 'Keep the summary under 280 characters'),
  longDescriptionMarkdown: z
    .string()
    .trim()
    .min(1, 'Describe your product')
    .max(20000, 'The description is too long (20,000 characters at most)'),
});
export type BasicsForm = z.infer<typeof basicsSchema>;

export const MIN_IMAGES = 5;
export const MAX_IMAGES = 10;

export const imagesSchema = z.object({
  images: z
    .array(z.object({ url: z.string().min(1).max(1000), primary: z.boolean() }))
    .min(MIN_IMAGES, `Add at least ${MIN_IMAGES} photos`)
    .max(MAX_IMAGES, `${MAX_IMAGES} photos at most`),
});

const money = (label: string) =>
  z
    .number({ invalid_type_error: `Enter the ${label}` })
    .min(0, `The ${label} cannot be negative`)
    .max(100_000_000, `The ${label} is too large`);

export const optionSchema = z.object({
  name: z.string().trim().min(1, 'Name the option').max(40, 'Option names are 40 characters at most'),
  kind: z.number(),
  values: z
    .array(z.string().trim().min(1).max(60, 'Values are 60 characters at most'))
    .min(1, 'Add at least one value')
    .max(30, '30 values at most')
    .refine((v) => new Set(v.map((x) => x.toLowerCase())).size === v.length, 'Each value must be different'),
});
export type OptionForm = z.infer<typeof optionSchema>;

export const variantRowSchema = z.object({
  key: z.string(),
  values: z.array(z.string()),
  sku: z.string().trim().min(1, 'SKU needed').max(64, 'SKU is 64 characters at most'),
  price: z.number().min(0).nullable(),
  stock: z.number().int('Whole numbers only').min(0, 'Cannot be negative'),
});
export type VariantRow = z.infer<typeof variantRowSchema>;

export const pricingSchema = z
  .object({
    sku: z.string().trim().min(1, 'Add a SKU (your own product code)').max(64, 'SKU is 64 characters at most'),
    price: money('price').gt(0, 'Set a selling price above Rs 0'),
    costPrice: money('cost price'),
    stock: z.number({ invalid_type_error: 'Enter how many you have' }).int('Whole numbers only').min(0, 'Cannot be negative'),
    trackInventory: z.boolean(),
    allowOverselling: z.boolean(),
    options: z.array(optionSchema).max(3, 'Up to 3 options (e.g. size, colour, material)'),
    variants: z.array(variantRowSchema),
  })
  .superRefine((v, ctx) => {
    const names = v.options.map((o) => o.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Each option needs a different name' });
    if (v.options.length > 0 && v.variants.length === 0)
      ctx.addIssue({ code: 'custom', path: ['variants'], message: 'Add at least one variant' });
    const skus = v.variants.map((r) => r.sku.trim().toLowerCase());
    if (new Set(skus).size !== skus.length) ctx.addIssue({ code: 'custom', path: ['variants'], message: 'Every variant needs its own SKU' });
  });
export type PricingForm = z.infer<typeof pricingSchema>;

export const shippingSchema = z
  .object({
    processingTimeDays: z.number().int().min(0).max(60, 'Up to 60 days'),
    weightGrams: z.number().int('Whole grams only').min(1, 'Enter the packed weight').max(1_000_000, 'Up to 1,000 kg'),
    lengthCm: z.number().min(0).max(500, 'Up to 500 cm'),
    widthCm: z.number().min(0).max(500, 'Up to 500 cm'),
    heightCm: z.number().min(0).max(500, 'Up to 500 cm'),
    options: z.array(
      z.object({
        kind: z.number(),
        enabled: z.boolean(),
        fee: z.number().min(0, 'Fee cannot be negative'),
        daysMin: z.number().int().min(0).max(90),
        daysMax: z.number().int().min(0).max(90),
      }),
    ),
  })
  .superRefine((v, ctx) => {
    const on = v.options.filter((o) => o.enabled);
    if (on.length === 0) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Turn on at least one way to get the product to customers' });
    on.forEach((o) => {
      if (o.daysMin > o.daysMax)
        ctx.addIssue({ code: 'custom', path: ['options'], message: 'Delivery days: the minimum cannot be more than the maximum' });
    });
  });
export type ShippingForm = z.infer<typeof shippingSchema>;

/** Zod issues → `{ field: message }` (first message per top-level field). */
export function issuesOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

// ---------------------------------------------------------------- variants

/** Every combination of the options' values, in option order. */
export function combinations(options: OptionForm[]): string[][] {
  const usable = options.filter((o) => o.values.length > 0);
  if (usable.length === 0) return [];
  return usable.reduce<string[][]>((acc, o) => acc.flatMap((combo) => o.values.map((v) => [...combo, v])), [[]]);
}

const slug = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 8);

/**
 * Rebuilds the variant rows when options change, keeping what the seller already typed for a
 * combination that still exists.
 */
export function syncVariants(options: OptionForm[], previous: VariantRow[], baseSku: string, baseStock: number): VariantRow[] {
  const byKey = new Map(previous.map((r) => [r.key, r]));
  return combinations(options).map((values) => {
    const key = values.join(' / ');
    const kept = byKey.get(key);
    if (kept) return { ...kept, values };
    return {
      key,
      values,
      sku: `${baseSku || 'SKU'}-${values.map(slug).join('-')}`.slice(0, 64),
      price: null,
      stock: baseStock,
    };
  });
}

export function toPricingRequest(form: PricingForm, hadOptions: boolean): PricingRequest {
  const base: PricingRequest = {
    sku: form.variants[0]?.sku.trim() ?? form.sku.trim(),
    priceAmount: form.price,
    priceCurrency: 'NPR',
    costPriceAmount: form.costPrice,
    costPriceCurrency: 'NPR',
    trackInventory: form.trackInventory,
    allowOverselling: form.allowOverselling,
    quantityOnHand: form.variants[0]?.stock ?? form.stock,
    productKind: 1,
    billingCadence: 1,
  };
  if (form.options.length === 0) {
    base.sku = form.sku.trim();
    base.quantityOnHand = form.stock;
    // Clearing previously saved options needs explicit empty arrays; otherwise leave both out.
    return hadOptions ? { ...base, options: [], variants: [] } : base;
  }
  const options: OptionInput[] = form.options.map((o, i) => ({
    name: o.name.trim(),
    kind: o.kind,
    sortOrder: i,
    values: o.values.map((v, j) => ({ value: v.trim(), sortOrder: j, swatchHex: null })),
  }));
  const variants: VariantInput[] = form.variants.map((r, i) => ({
    sku: r.sku.trim(),
    isDefault: i === 0,
    priceAmount: r.price,
    costPriceAmount: null,
    quantityOnHand: r.stock,
    optionValues: r.values.map((value, k) => ({ option: form.options[k].name.trim(), value })),
  }));
  return { ...base, options, variants };
}

export function toShippingRequest(form: ShippingForm): ShippingRequest {
  return {
    processingTimeDays: form.processingTimeDays,
    weightGrams: form.weightGrams,
    lengthCm: form.lengthCm,
    widthCm: form.widthCm,
    heightCm: form.heightCm,
    shippingOptions: form.options
      .filter((o) => o.enabled)
      .map((o) => ({ kind: o.kind, feeAmount: o.fee, feeCurrency: 'NPR', estimatedDaysMin: o.daysMin, estimatedDaysMax: o.daysMax })),
  };
}

export const OPTION_PRESETS = [
  { label: 'Size', kind: ProductOptionKind.Size },
  { label: 'Colour', kind: ProductOptionKind.Colour },
  { label: 'Material', kind: ProductOptionKind.Material },
  { label: 'Style', kind: ProductOptionKind.Style },
];
