import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { mockApi, renderWithProviders } from '../../test/utils';
import type { Product } from './api';
import ProductEditorPage from './ProductEditorPage';
import { TryOnStep } from './steps/TryOnStep';
import { checkTryOnImage, initialChartForm, toSizeChartInput, validateSizeChart, type SizeChartForm } from './tryon';

const sizeOption = { id: 'o1', name: 'Size', kind: 1, sortOrder: 0, values: ['S', 'M', 'L'].map((v, i) => ({ id: `ov${i}`, value: v, sortOrder: i, swatchHex: null })) };

const product = (patch: Partial<Product> = {}): Product => ({
  id: 'p1',
  vendorAccountId: 'v1',
  categoryId: 'c1',
  name: 'Linen shirt',
  shortDescription: 'Cool',
  longDescriptionMarkdown: 'Cool linen',
  shipsFromAddressId: null,
  processingTimeDays: 1,
  state: 1,
  wizardStepReached: 4,
  averageRating: 0,
  reviewCount: 0,
  createdUtc: '2026-10-01T00:00:00Z',
  updatedUtc: '2026-10-01T00:00:00Z',
  variants: [],
  options: [sizeOption],
  images: [],
  video: null,
  shippingOptions: [],
  isInStock: true,
  defaultVariantId: null,
  ...patch,
});

const readiness = (patch = {}) => ({
  productId: 'p1',
  hasSizeChart: false,
  hasTryOnImage: false,
  ready: false,
  garmentType: null,
  imageUrl: null,
  problems: ['Add a size chart.', 'Add a try-on image.'],
  ...patch,
});

const form = (patch: Partial<SizeChartForm> = {}): SizeChartForm => ({
  garmentType: 1,
  unit: 1,
  fitNote: '',
  rows: [
    { key: 'a', sizeLabel: 'S', values: { chest: 92 } },
    { key: 'b', sizeLabel: 'M', values: { chest: 98, length: 70 } },
  ],
  ...patch,
});

describe('size chart rules (contract)', () => {
  it('accepts a valid chart and builds the PUT body with only the garment type’s columns', () => {
    expect(validateSizeChart(form())).toBeNull();
    expect(toSizeChartInput(form({ fitNote: '  Runs small ' }))).toEqual({
      garmentType: 1,
      unit: 1,
      fitNote: 'Runs small',
      rows: [
        { sizeLabel: 'S', chest: 92, shoulder: null, length: null },
        { sizeLabel: 'M', chest: 98, shoulder: null, length: 70 },
      ],
    });
  });

  it('requires the measurements of the garment type', () => {
    const top = validateSizeChart(form({ rows: [{ key: 'a', sizeLabel: 'S', values: {} }] }))!;
    expect(top.rows[0].chest).toMatch(/required/);
    const dress = validateSizeChart(form({ garmentType: 3, rows: [{ key: 'a', sizeLabel: 'S', values: { chest: 90 } }] }))!;
    expect(dress.rows[0].waist).toMatch(/required/);
    expect(validateSizeChart(form({ garmentType: 6, rows: [{ key: 'a', sizeLabel: '40', values: {} }] }))!.rows[0].footLength).toMatch(/required/);
    expect(validateSizeChart(form({ garmentType: 7, rows: [{ key: 'a', sizeLabel: 'One', values: {} }] }))).toBeNull();
  });

  it('rejects duplicate / long / empty labels, out-of-range values, too many rows and long notes', () => {
    const dup = validateSizeChart(form({ rows: [{ key: 'a', sizeLabel: 'M', values: { chest: 1 } }, { key: 'b', sizeLabel: 'm', values: { chest: 1 } }] }))!;
    expect(dup.rows[1].sizeLabel).toMatch(/different/);
    expect(validateSizeChart(form({ rows: [{ key: 'a', sizeLabel: 'x'.repeat(17), values: { chest: 1 } }] }))!.rows[0].sizeLabel).toMatch(/16/);
    expect(validateSizeChart(form({ rows: [{ key: 'a', sizeLabel: ' ', values: { chest: 1 } }] }))!.rows[0].sizeLabel).toMatch(/enter/i);
    expect(validateSizeChart(form({ rows: [{ key: 'a', sizeLabel: 'S', values: { chest: 0 } }] }))!.rows[0].chest).toMatch(/more than 0/);
    expect(validateSizeChart(form({ rows: [{ key: 'a', sizeLabel: 'S', values: { chest: 301 } }] }))!.rows[0].chest).toMatch(/300 cm/);
    expect(validateSizeChart(form({ unit: 2, rows: [{ key: 'a', sizeLabel: 'S', values: { chest: 121 } }] }))!.rows[0].chest).toMatch(/120 in/);
    expect(validateSizeChart(form({ rows: [] }))!.form).toMatch(/at least one/);
    const many = Array.from({ length: 21 }, (_, i) => ({ key: `${i}`, sizeLabel: `S${i}`, values: { chest: 90 } }));
    expect(validateSizeChart(form({ rows: many }))!.form).toMatch(/20/);
    expect(validateSizeChart(form({ fitNote: 'x'.repeat(301) }))!.fitNote).toMatch(/300/);
  });

  it('prefills size labels from the product’s size option', () => {
    expect(initialChartForm(product(), null).rows.map((r) => r.sizeLabel)).toEqual(['S', 'M', 'L']);
    expect(initialChartForm(product({ options: [] }), null).rows.map((r) => r.sizeLabel)).toEqual(['']);
  });
});

describe('try-on image checks', () => {
  const file = (type: string, size = 1000) => new File([new Uint8Array(size)], 'g.png', { type });
  it('checks type, size, dimensions and transparency', () => {
    expect(checkTryOnImage(file('image/jpeg'), null)[0]).toMatch(/PNG or WebP/);
    expect(checkTryOnImage(file('image/png', 5 * 1024 * 1024 + 1), null)[0]).toMatch(/5 MB/);
    expect(checkTryOnImage(file('image/webp'), { width: 500, height: 900, transparentRatio: 0.5 })[0]).toMatch(/600 px/);
    expect(checkTryOnImage(file('image/png'), { width: 800, height: 900, transparentRatio: 0.05 })[0]).toMatch(/background/i);
    expect(checkTryOnImage(file('image/png'), { width: 800, height: 900, transparentRatio: 0.99 })[0]).toMatch(/transparent/i);
    expect(checkTryOnImage(file('image/png'), { width: 800, height: 900, transparentRatio: null })).toEqual([]);
    expect(checkTryOnImage(file('image/png'), null)).toEqual([]);
  });
});

describe('Try-on & sizes step (UI)', () => {
  it('saves a size chart with a PUT', async () => {
    const calls = mockApi({
      'GET /v1/vendor/products/p1/try-on': { body: readiness() },
      'GET /v1/vendor/products/p1/size-chart': { status: 404, body: { title: 'Not found', errorCode: 'catalog.size_chart_not_found' } },
      'PUT /v1/vendor/products/p1/size-chart': (c) => ({ body: { ...(c.body as object), productId: 'p1', updatedUtc: '2026-10-14T00:00:00Z' } }),
    });
    renderWithProviders(<TryOnStep product={product()} onContinue={() => {}} />);
    const user = userEvent.setup();
    await screen.findByLabelText('Size label 1');
    await user.click(screen.getByRole('button', { name: /save size chart/i }));
    expect(await screen.findAllByText('Chest is required')).toHaveLength(3);
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);

    for (const [i, v] of [['S', '92'], ['M', '98'], ['L', '104']]) await user.type(screen.getByLabelText(`Chest for size ${i}`), v);
    await user.click(screen.getByRole('button', { name: /save size chart/i }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')).toBeTruthy());
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.headers['Idempotency-Key']).toBeTruthy();
    expect(put.body).toEqual({
      garmentType: 1,
      unit: 1,
      fitNote: null,
      rows: [
        { sizeLabel: 'S', chest: 92, shoulder: null, length: null },
        { sizeLabel: 'M', chest: 98, shoulder: null, length: null },
        { sizeLabel: 'L', chest: 104, shoulder: null, length: null },
      ],
    });
  });

  it('rejects a bad image before upload and uploads a good one; shows server messages', async () => {
    let status = 400;
    const calls = mockApi({
      'GET /v1/vendor/products/p1/try-on': { body: readiness() },
      'GET /v1/vendor/products/p1/size-chart': { status: 404 },
      'POST /v1/vendor/products/p1/try-on-image': () =>
        status === 400
          ? { status: 400, body: { title: 'Validation failed', detail: 'At least 15% of the image must be transparent.', errorCode: 'validation.invalid_format', field: 'file' } }
          : { body: { productId: 'p1', imageUrl: 'https://cdn/tryon.png', width: 800, height: 1000, updatedUtc: 'x' } },
    });
    const bitmap = vi.fn(async () => ({ width: 400, height: 900, close: () => {} }));
    vi.stubGlobal('createImageBitmap', bitmap);
    renderWithProviders(<TryOnStep product={product()} onContinue={() => {}} />);
    const user = userEvent.setup();
    const input = (await screen.findByLabelText('Upload try-on image')).querySelector('input[type=file]') as HTMLInputElement;

    await user.upload(input, new File(['x'], 'shirt.png', { type: 'image/png' }));
    expect(await screen.findByText(/shortest side must be at least 600 px/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    bitmap.mockResolvedValue({ width: 800, height: 1000, close: () => {} });
    await user.upload(input, new File(['x'], 'shirt.png', { type: 'image/png' }));
    expect(await screen.findByText(/15% of the image must be transparent/)).toBeInTheDocument();

    status = 200;
    await user.upload(input, new File(['x'], 'shirt.png', { type: 'image/png' }));
    expect(await screen.findByAltText(/try-on image of linen shirt/i)).toHaveAttribute('src', 'https://cdn/tryon.png');
    expect(calls.filter((c) => c.method === 'POST' && c.path.endsWith('/try-on-image'))).toHaveLength(2);
  });

  it('shows "coming soon" when the endpoints are not deployed', async () => {
    mockApi({});
    const onContinue = vi.fn();
    renderWithProviders(<TryOnStep product={product()} onContinue={onContinue} />);
    expect(await screen.findByText('Try-on setup is coming soon')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalled();
  });
});

describe('publishing needs a size chart for sized products', () => {
  const renderEditor = () =>
    renderWithProviders(
      <Routes>
        <Route path="/products/:id" element={<ProductEditorPage />} />
      </Routes>,
      { route: '/products/p1' },
    );

  it('blocks publish without a chart and links to the step; image is only a warning', async () => {
    mockApi({
      'GET /v1/vendor/products/p1': { body: product() },
      'GET /v1/vendor/products/p1/try-on': { body: readiness() },
      'GET /v1/vendor/products/p1/size-chart': { status: 404 },
      'GET /v1/vendor/products/p1/attributes': { body: { productId: 'p1', categoryId: 'c1', applicableDefinitions: [], values: [] } },
    });
    renderEditor();
    const user = userEvent.setup();
    // Opens on the try-on step after delivery; continue to publish.
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    const alert = (await screen.findByText(/needs a size chart/i)).closest('[role=alert]') as HTMLElement;
    expect(alert).toBeTruthy();
    expect(screen.getByRole('button', { name: /publish product/i })).toBeDisabled();
    await user.click(within(alert).getByRole('button', { name: /go to try-on/i }));
    expect(await screen.findByRole('button', { name: /save size chart/i })).toBeInTheDocument();
  });

  it('allows publish with a chart (warning about the image) and when try-on is not deployed', async () => {
    const routes = {
      'GET /v1/vendor/products/p1': { body: product() },
      'GET /v1/vendor/products/p1/size-chart': { status: 404 },
      'GET /v1/vendor/products/p1/attributes': { body: { productId: 'p1', categoryId: 'c1', applicableDefinitions: [], values: [] } },
    };
    mockApi({ ...routes, 'GET /v1/vendor/products/p1/try-on': { body: readiness({ hasSizeChart: true, problems: [] }) } });
    const first = renderEditor();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(/no try-on image yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /publish product/i })).toBeEnabled();
    first.unmount();

    mockApi(routes);
    renderEditor();
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /publish product/i })).toBeEnabled());
    expect(screen.queryByText(/needs a size chart/i)).not.toBeInTheDocument();
  });
});
