import { api, ApiError } from '../../api/client';
import { ProductOptionKind, type Product } from './api';

/**
 * Virtual try-on product data (contract `tryon-contract.md` v1, Catalog vendor endpoints): the
 * size chart and the transparent garment overlay image. Enums are integers on the wire.
 */

export const GarmentType = { Top: 1, Bottom: 2, Dress: 3, Outerwear: 4, FullBody: 5, Footwear: 6, Accessory: 7 } as const;
export const garmentTypeLabel: Record<number, string> = {
  1: 'Top (shirt, t-shirt, kurta…)',
  2: 'Bottom (trousers, skirt, shorts…)',
  3: 'Dress',
  4: 'Outerwear (jacket, coat…)',
  5: 'Full body (jumpsuit, saree set…)',
  6: 'Footwear',
  7: 'Accessory',
};
export const MeasurementUnit = { Cm: 1, Inch: 2 } as const;
export const unitLabel: Record<number, string> = { 1: 'cm', 2: 'in' };

export type MeasurementKey = 'chest' | 'waist' | 'hips' | 'shoulder' | 'length' | 'inseam' | 'footLength';
export const measurementLabel: Record<MeasurementKey, string> = {
  chest: 'Chest',
  waist: 'Waist',
  hips: 'Hips',
  shoulder: 'Shoulder',
  length: 'Length',
  inseam: 'Inseam',
  footLength: 'Foot length',
};

/** Columns shown per garment type (required ones first). */
export const measurementsFor: Record<number, MeasurementKey[]> = {
  1: ['chest', 'shoulder', 'length'],
  2: ['waist', 'hips', 'inseam', 'length'],
  3: ['chest', 'waist', 'hips', 'shoulder', 'length'],
  4: ['chest', 'shoulder', 'length'],
  5: ['chest', 'waist', 'hips', 'shoulder', 'inseam', 'length'],
  6: ['footLength'],
  7: ['length'],
};
/** Required per the contract. */
export const requiredFor: Record<number, MeasurementKey[]> = {
  1: ['chest'],
  2: ['waist'],
  3: ['chest', 'waist'],
  4: ['chest'],
  5: ['chest', 'waist'],
  6: ['footLength'],
  7: [],
};

export interface SizeChartRowInput {
  sizeLabel: string;
  chest?: number | null;
  waist?: number | null;
  hips?: number | null;
  shoulder?: number | null;
  length?: number | null;
  inseam?: number | null;
  footLength?: number | null;
}
export interface SizeChartInput {
  garmentType: number;
  unit: number;
  rows: SizeChartRowInput[];
  fitNote?: string | null;
}
export interface SizeChartDto extends SizeChartInput {
  productId: string;
  updatedUtc: string;
}
export interface TryOnImageDto {
  productId: string;
  imageUrl: string;
  width: number;
  height: number;
  updatedUtc: string;
}
export interface TryOnReadinessDto {
  productId: string;
  hasSizeChart: boolean;
  hasTryOnImage: boolean;
  ready: boolean;
  garmentType: number | null;
  imageUrl: string | null;
  problems: string[];
}

const base = '/v1/vendor/products';

export const tryOnApi = {
  /** `null` when the product has no size chart yet (404). */
  sizeChart: async (id: string): Promise<SizeChartDto | null> => {
    try {
      return await api.get<SizeChartDto>(`${base}/${id}/size-chart`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },
  putSizeChart: (id: string, body: SizeChartInput) => api.put<SizeChartDto>(`${base}/${id}/size-chart`, body),
  deleteSizeChart: (id: string) => api.del<void>(`${base}/${id}/size-chart`),
  uploadImage: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<TryOnImageDto>(`${base}/${id}/try-on-image`, form);
  },
  deleteImage: (id: string) => api.del<void>(`${base}/${id}/try-on-image`),
  readiness: (id: string) => api.get<TryOnReadinessDto>(`${base}/${id}/try-on`),
};

export const tryOnKey = (id: string) => ['product', id, 'try-on'] as const;
export const sizeChartKey = (id: string) => ['product', id, 'size-chart'] as const;

// ---------------------------------------------------------------- size chart form

export interface SizeRowForm {
  /** Stable React key. */
  key: string;
  sizeLabel: string;
  values: Partial<Record<MeasurementKey, number | null>>;
}
export interface SizeChartForm {
  garmentType: number;
  unit: number;
  rows: SizeRowForm[];
  fitNote: string;
}

export const MAX_ROWS = 20;
export const maxMeasurement = (unit: number) => (unit === MeasurementUnit.Inch ? 120 : 300);

/** The product's size option values, e.g. ["S", "M", "L"]. */
export function sizeValuesOf(product: Product): string[] {
  const opt = product.options.find((o) => o.kind === ProductOptionKind.Size) ?? product.options.find((o) => o.name.trim().toLowerCase() === 'size');
  if (!opt) return [];
  return [...opt.values].sort((a, b) => a.sortOrder - b.sortOrder).map((v) => v.value);
}

/** Owner rule: a product with a size option needs a size chart before it is published. */
export const needsSizeChart = (product: Product) => sizeValuesOf(product).length > 0;

let seq = 0;
export const rowKey = () => `row-${++seq}`;

export function initialChartForm(product: Product, chart: SizeChartDto | null): SizeChartForm {
  if (chart) {
    return {
      garmentType: chart.garmentType,
      unit: chart.unit,
      fitNote: chart.fitNote ?? '',
      rows: chart.rows.map((r) => {
        const values: SizeRowForm['values'] = {};
        (Object.keys(measurementLabel) as MeasurementKey[]).forEach((k) => {
          if (r[k] !== null && r[k] !== undefined) values[k] = r[k];
        });
        return { key: rowKey(), sizeLabel: r.sizeLabel, values };
      }),
    };
  }
  const labels = sizeValuesOf(product).slice(0, MAX_ROWS);
  return {
    garmentType: GarmentType.Top,
    unit: MeasurementUnit.Cm,
    fitNote: '',
    rows: (labels.length ? labels : ['']).map((l) => ({ key: rowKey(), sizeLabel: l, values: {} })),
  };
}

export interface ChartIssues {
  form: string | null;
  fitNote: string | null;
  /** Per row index: field → message (`sizeLabel` or a measurement). */
  rows: Record<number, Partial<Record<'sizeLabel' | MeasurementKey, string>>>;
}

/** Client copy of the backend rules. `null` when the chart is valid. */
export function validateSizeChart(form: SizeChartForm): ChartIssues | null {
  const issues: ChartIssues = { form: null, fitNote: null, rows: {} };
  let bad = false;
  const setRow = (i: number, field: 'sizeLabel' | MeasurementKey, msg: string) => {
    issues.rows[i] = { ...issues.rows[i], [field]: msg };
    bad = true;
  };
  if (form.rows.length < 1) {
    issues.form = 'Add at least one size';
    bad = true;
  }
  if (form.rows.length > MAX_ROWS) {
    issues.form = `${MAX_ROWS} sizes at most`;
    bad = true;
  }
  const max = maxMeasurement(form.unit);
  const unit = unitLabel[form.unit] ?? 'cm';
  const shown = measurementsFor[form.garmentType] ?? [];
  const required = requiredFor[form.garmentType] ?? [];
  const seen = new Map<string, number>();
  form.rows.forEach((r, i) => {
    const label = r.sizeLabel.trim();
    if (!label) setRow(i, 'sizeLabel', 'Enter the size');
    else if (label.length > 16) setRow(i, 'sizeLabel', '16 characters at most');
    else if (seen.has(label.toLowerCase())) setRow(i, 'sizeLabel', 'Each size must be different');
    else seen.set(label.toLowerCase(), i);
    shown.forEach((k) => {
      const v = r.values[k];
      if (v === null || v === undefined) {
        if (required.includes(k)) setRow(i, k, `${measurementLabel[k]} is required`);
      } else if (!(v > 0)) setRow(i, k, 'Must be more than 0');
      else if (v > max) setRow(i, k, `${max} ${unit} at most`);
    });
  });
  if (form.fitNote.length > 300) {
    issues.fitNote = 'The fit note is 300 characters at most';
    bad = true;
  }
  return bad ? issues : null;
}

/** Form → PUT body. Only the garment type's columns are sent; blanks become null. */
export function toSizeChartInput(form: SizeChartForm): SizeChartInput {
  const shown = measurementsFor[form.garmentType] ?? [];
  const note = form.fitNote.trim();
  return {
    garmentType: form.garmentType,
    unit: form.unit,
    fitNote: note ? note : null,
    rows: form.rows.map((r) => {
      const row: SizeChartRowInput = { sizeLabel: r.sizeLabel.trim() };
      shown.forEach((k) => {
        const v = r.values[k];
        row[k] = v === undefined ? null : v;
      });
      return row;
    }),
  };
}

// ---------------------------------------------------------------- try-on image checks

export const TRYON_MAX_BYTES = 5 * 1024 * 1024;
export const TRYON_MIN_SIDE = 600;
export const TRYON_TYPES = ['image/png', 'image/webp'];

export interface ImageInfo {
  width: number;
  height: number;
  /** Fraction (0..1) of fully transparent pixels, or null when it could not be measured. */
  transparentRatio: number | null;
}

/** Problems found before upload (empty = looks fine). `info` null = could not be measured: skip. */
export function checkTryOnImage(file: File, info: ImageInfo | null): string[] {
  const problems: string[] = [];
  if (!TRYON_TYPES.includes(file.type)) problems.push('Use a PNG or WebP image with a transparent background.');
  if (file.size > TRYON_MAX_BYTES) problems.push('The image is larger than 5 MB.');
  if (info) {
    if (Math.min(info.width, info.height) < TRYON_MIN_SIDE)
      problems.push(`The image is ${info.width} × ${info.height} px — the shortest side must be at least ${TRYON_MIN_SIDE} px.`);
    if (info.transparentRatio !== null) {
      if (info.transparentRatio < 0.15) problems.push('The background is not removed — at least 15% of the image must be fully transparent.');
      else if (info.transparentRatio > 0.98) problems.push('The image is almost completely transparent — the garment is missing.');
    }
  }
  return problems;
}

/**
 * Reads dimensions and the transparent-pixel ratio in the browser. Returns null where the browser
 * (or jsdom) cannot decode images; the server checks again anyway.
 */
export async function readImageInfo(file: File): Promise<ImageInfo | null> {
  if (typeof createImageBitmap !== 'function') return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  const { width, height } = bitmap;
  let transparentRatio: number | null = null;
  try {
    const scale = Math.min(1, 256 / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(bitmap, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      let clear = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] === 0) clear++;
      transparentRatio = clear / (w * h);
    }
  } catch {
    transparentRatio = null;
  }
  bitmap.close?.();
  return { width, height, transparentRatio };
}
