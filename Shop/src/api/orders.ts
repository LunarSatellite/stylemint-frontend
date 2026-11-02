import { api } from './client';

export interface OrderLine {
  id: string;
  quantity: number;
  unitPriceAmount: number;
  unitPriceCurrency: string;
  productTitleSnapshot: string;
  optionLabel: string | null;
  variantLabelSnapshot: string | null;
  thumbnailUrlSnapshot: string | null;
  bundleTitleSnapshot?: string | null;
}

export interface SubOrder {
  id: string;
  vendorAccountId: string;
  /** Not on today's DTO; the placed page looks the shop name up when missing. */
  vendorDisplayName?: string | null;
  state: number;
  subtotalAmount: number;
  subtotalCurrency: string;
  lines: OrderLine[];
}

export interface Order {
  id: string;
  orderNumber: string;
  state: number;
  paymentMethod: number;
  grandTotalAmount: number;
  grandTotalCurrency: string;
  shippingTotalAmount: number;
  subOrders: SubOrder[];
}

export const ordersApi = {
  get: (orderNumber: string) => api.get<Order>(`/v1/orders/${encodeURIComponent(orderNumber)}`),
};
