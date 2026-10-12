import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mockApi, renderWithProviders } from '../../test/utils';
import { emiInstallment, type Product } from './api';
import {
  basicsSchema,
  combinations,
  imagesSchema,
  issuesOf,
  pricingSchema,
  shippingSchema,
  syncVariants,
  toPricingRequest,
  toShippingRequest,
  type PricingForm,
} from './schemas';
import { BasicsStep } from './steps/BasicsStep';
import { PhotosStep } from './steps/PhotosStep';
import { PricingStep } from './steps/PricingStep';

const pricing = (patch: Partial<PricingForm> = {}): PricingForm => ({
  sku: 'SWTR',
  price: 2500,
  costPrice: 1200,
  stock: 10,
  trackInventory: true,
  allowOverselling: false,
  options: [],
  variants: [],
  ...patch,
});

const product = (patch: Partial<Product> = {}): Product => ({
  id: 'p1',
  vendorAccountId: 'v1',
  categoryId: 'c1',
  name: 'Woollen sweater',
  shortDescription: 'Warm',
  longDescriptionMarkdown: 'Warm and soft',
  shipsFromAddressId: null,
  processingTimeDays: 1,
  state: 1,
  wizardStepReached: 2,
  averageRating: 0,
  reviewCount: 0,
  createdUtc: '2026-10-01T00:00:00Z',
  updatedUtc: '2026-10-01T00:00:00Z',
  variants: [
    {
      id: 'v-def',
      productId: 'p1',
      sku: 'DRAFT-ABCDEF12',
      isDefault: true,
      priceAmount: 0,
      priceCurrency: 'NPR',
      costPriceAmount: 0,
      costPriceCurrency: 'NPR',
      trackInventory: true,
      allowOverselling: false,
      quantityOnHand: 0,
      productKind: 1,
      billingCadence: 1,
      weightGrams: 0,
      lengthCm: 0,
      widthCm: 0,
      heightCm: 0,
      optionValueIds: [],
      optionLabel: null,
    },
  ],
  options: [],
  images: [],
  video: null,
  shippingOptions: [],
  isInStock: false,
  defaultVariantId: 'v-def',
  ...patch,
});

describe('product wizard validation (schemas)', () => {
  it('step 1 needs a category, name, summary and description within limits', () => {
    const r = basicsSchema.safeParse({ categoryId: '', name: ' ', shortDescription: 'x'.repeat(281), longDescriptionMarkdown: '' });
    expect(r.success).toBe(false);
    const issues = issuesOf(r.error!);
    expect(issues.categoryId).toMatch(/category/i);
    expect(issues.name).toMatch(/name/i);
    expect(issues.shortDescription).toMatch(/280/);
    expect(issues.longDescriptionMarkdown).toMatch(/describe/i);
  });

  it('step 2 needs 5–10 photos', () => {
    const photos = (n: number) => ({ images: Array.from({ length: n }, (_, i) => ({ url: `https://cdn/x${i}.jpg`, primary: i === 0 })) });
    expect(imagesSchema.safeParse(photos(4)).success).toBe(false);
    expect(imagesSchema.safeParse(photos(5)).success).toBe(true);
    expect(imagesSchema.safeParse(photos(11)).success).toBe(false);
  });

  it('step 3 rejects a zero price, duplicate SKUs and options without variants', () => {
    expect(issuesOf(pricingSchema.safeParse(pricing({ price: 0 })).error!).price).toMatch(/above Rs 0/);
    const opts = [{ name: 'Size', kind: 1, values: ['S', 'M'] }];
    expect(issuesOf(pricingSchema.safeParse(pricing({ options: opts, variants: [] })).error!).variants).toMatch(/at least one variant/i);
    const dupes = [
      { key: 'S', values: ['S'], sku: 'A', price: null, stock: 1 },
      { key: 'M', values: ['M'], sku: 'a', price: null, stock: 1 },
    ];
    expect(issuesOf(pricingSchema.safeParse(pricing({ options: opts, variants: dupes })).error!).variants).toMatch(/own SKU/i);
    const twice = [
      { name: 'Size', kind: 1, values: ['S'] },
      { name: 'size', kind: 99, values: ['L'] },
    ];
    expect(issuesOf(pricingSchema.safeParse(pricing({ options: twice, variants: [] })).error!).options).toMatch(/different name/i);
  });

  it('step 4 needs at least one delivery method and a weight', () => {
    const base = {
      processingTimeDays: 1,
      weightGrams: 500,
      lengthCm: 10,
      widthCm: 10,
      heightCm: 5,
      options: [{ kind: 1, enabled: false, fee: 100, daysMin: 2, daysMax: 5 }],
    };
    expect(issuesOf(shippingSchema.safeParse(base).error!).options).toMatch(/at least one/i);
    expect(issuesOf(shippingSchema.safeParse({ ...base, weightGrams: 0 }).error!).weightGrams).toMatch(/weight/i);
    const backwards = { ...base, options: [{ kind: 1, enabled: true, fee: 100, daysMin: 5, daysMax: 2 }] };
    expect(issuesOf(shippingSchema.safeParse(backwards).error!).options).toMatch(/minimum/i);
  });

  it('builds every size × colour combination and keeps typed values', () => {
    const options = [
      { name: 'Size', kind: 1, values: ['S', 'M'] },
      { name: 'Colour', kind: 2, values: ['Red', 'Black'] },
    ];
    expect(combinations(options)).toEqual([
      ['S', 'Red'],
      ['S', 'Black'],
      ['M', 'Red'],
      ['M', 'Black'],
    ]);
    const first = syncVariants(options, [], 'SWTR', 3);
    expect(first.map((r) => r.sku)).toEqual(['SWTR-S-RED', 'SWTR-S-BLACK', 'SWTR-M-RED', 'SWTR-M-BLACK']);
    const edited = first.map((r) => (r.key === 'M / Black' ? { ...r, stock: 9, price: 2800 } : r));
    const again = syncVariants([options[0], { ...options[1], values: ['Black'] }], edited, 'SWTR', 3);
    expect(again).toHaveLength(2);
    expect(again.find((r) => r.key === 'M / Black')).toMatchObject({ stock: 9, price: 2800 });
  });

  it('maps the pricing form to the API body (NPR, integer enums, options by name)', () => {
    const options = [{ name: 'Size', kind: 1, values: ['S', 'M'] }];
    const variants = syncVariants(options, [], 'SWTR', 4);
    const body = toPricingRequest(pricing({ options, variants }), false);
    expect(body).toMatchObject({ priceCurrency: 'NPR', productKind: 1, billingCadence: 1, sku: 'SWTR-S' });
    expect(body.options).toEqual([{ name: 'Size', kind: 1, sortOrder: 0, values: [{ value: 'S', sortOrder: 0, swatchHex: null }, { value: 'M', sortOrder: 1, swatchHex: null }] }]);
    expect(body.variants![0]).toMatchObject({ sku: 'SWTR-S', isDefault: true, optionValues: [{ option: 'Size', value: 'S' }] });
    expect(body.variants![1].isDefault).toBe(false);
    // Removing every option from a product that had some must clear them explicitly.
    expect(toPricingRequest(pricing(), true)).toMatchObject({ options: [], variants: [] });
    expect(toPricingRequest(pricing(), false).options).toBeUndefined();
  });

  it('sends only enabled shipping options', () => {
    const body = toShippingRequest({
      processingTimeDays: 2,
      weightGrams: 500,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 5,
      options: [
        { kind: 1, enabled: true, fee: 100, daysMin: 2, daysMax: 4 },
        { kind: 2, enabled: false, fee: 250, daysMin: 1, daysMax: 1 },
      ],
    });
    expect(body.shippingOptions).toEqual([{ kind: 1, feeAmount: 100, feeCurrency: 'NPR', estimatedDaysMin: 2, estimatedDaysMax: 4 }]);
  });

  it('EMI arithmetic matches the contract (round up, last instalment absorbs rounding)', () => {
    expect(emiInstallment(25_000, 30, 6)).toEqual({ downPayment: 7500, financed: 17500, installment: 2917, last: 2915 });
  });
});

describe('product wizard steps (UI)', () => {
  it('step 1 shows what is missing and does not save', async () => {
    mockApi({ 'GET /v1/public/categories/tree': { body: [] } });
    const onSave = vi.fn();
    renderWithProviders(<BasicsStep product={null} onSave={onSave} saving={false} serverError={null} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /create draft and continue/i }));
    expect(await screen.findByText('Choose a category')).toBeInTheDocument();
    expect(screen.getByText('Give your product a name')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('step 1 saves a valid draft', async () => {
    mockApi({
      'GET /v1/public/categories/tree': {
        body: [
          { id: 'root', parentCategoryId: null, slug: 'women', nameEn: 'Women', displayOrder: 1, isGated: false, isActive: true },
          { id: 'c1', parentCategoryId: 'root', slug: 'sweaters', nameEn: 'Sweaters', displayOrder: 1, isGated: false, isActive: true },
        ],
      },
    });
    const onSave = vi.fn();
    renderWithProviders(<BasicsStep product={product()} onSave={onSave} saving={false} serverError={null} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /save and continue/i }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ categoryId: 'c1', name: 'Woollen sweater', shortDescription: 'Warm', longDescriptionMarkdown: 'Warm and soft' }),
    );
  });

  it('step 2 refuses to continue with fewer than 5 photos', async () => {
    const onSave = vi.fn();
    renderWithProviders(
      <PhotosStep
        product={product({ images: [{ id: 'i1', cdnUrl: 'https://cdn/1.jpg', sortOrder: 0, isPrimary: true }] })}
        onSave={onSave}
        saving={false}
        serverError={null}
      />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: /save and continue/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 5 photos/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('step 3 blocks a missing price and SKU (draft SKU is not offered)', async () => {
    const onSave = vi.fn();
    renderWithProviders(<PricingStep product={product()} onSave={onSave} saving={false} serverError={null} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /save and continue/i }));
    expect(await screen.findByText(/add a sku/i)).toBeInTheDocument();
    expect(screen.getByText(/above Rs 0/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
