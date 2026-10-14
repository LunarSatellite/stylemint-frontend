/** The Insights sections, in sidebar order. Kept free of heavy imports: the Shell reads it. */
export type InsightsSectionKey = 'sales' | 'products' | 'demand' | 'reels' | 'creators' | 'promotions' | 'customers';

export interface InsightsSection {
  key: InsightsSectionKey;
  to: string;
  label: string;
  short: string;
  description: string;
}

export const INSIGHTS_SECTIONS: InsightsSection[] = [
  {
    key: 'sales',
    to: '/insights/sales',
    label: 'Sales overview',
    short: 'Sales',
    description: 'Revenue, orders, average order value, conversion and returns — and where your sales come from.',
  },
  {
    key: 'products',
    to: '/insights/products',
    label: 'Products',
    short: 'Products',
    description: 'Best sellers, rising and falling products, stock risk, returns and ratings per product.',
  },
  {
    key: 'demand',
    to: '/insights/demand',
    label: 'Demand',
    short: 'Demand',
    description: 'What buyers search for and want — including searches StyleMint could not answer well.',
  },
  {
    key: 'reels',
    to: '/insights/reels',
    label: 'Reels performance',
    short: 'Reels',
    description: 'Reels that tag your products: views, engagement, product taps and the sales they bring.',
  },
  {
    key: 'creators',
    to: '/insights/creators',
    label: 'Creators & reach',
    short: 'Creators',
    description: 'Reach, clicks, orders, revenue and return on commission for every creator you work with.',
  },
  {
    key: 'promotions',
    to: '/insights/promotions',
    label: 'Promotions',
    short: 'Promotions',
    description: 'Flash sales, sponsored placements, campaigns, offers and EMI — and the lift each one brought.',
  },
  {
    key: 'customers',
    to: '/insights/customers',
    label: 'Customers',
    short: 'Customers',
    description: 'New and repeat buyers, retention and lifetime value — with links into your customer CRM.',
  },
];

export const RANGE_STORAGE_KEY = 'sm.seller.insightsRange';
