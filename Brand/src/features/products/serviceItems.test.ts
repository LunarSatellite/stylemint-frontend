import { describe, expect, it } from 'vitest';
import { isServiceItem, productPath } from './api';

describe('service items in the product list', () => {
  it('opens products in the wizard and service items on their listing', () => {
    expect(isServiceItem({})).toBe(false);
    expect(productPath({ id: 'p-1' })).toBe('/products/p-1');
    expect(isServiceItem({ serviceType: 1 })).toBe(true);
    expect(productPath({ id: 'lst-1', isService: true, serviceType: 1, serviceListingId: 'lst-1' })).toBe('/services/listings/lst-1');
    expect(productPath({ id: 'pkg-1', isService: true, serviceType: 2, serviceListingId: null })).toBe('/services/listings/pkg-1');
    expect(productPath({ id: 'bp-1', isService: true, serviceType: 3 })).toBe('/bank/products');
  });
});
