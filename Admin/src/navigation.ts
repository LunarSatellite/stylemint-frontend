import {
  IconActivity,
  IconCalendarCheck,
  IconCamera,
  IconAdjustments,
  IconBuildingStore,
  IconCash,
  IconCashBanknote,
  IconClipboardCheck,
  IconCreditCard,
  IconFlag,
  IconHeadset,
  IconHistory,
  IconHome,
  IconLayoutGrid,
  IconMotorbike,
  IconPackage,
  IconPercentage,
  IconReceipt,
  IconReceiptRefund,
  IconRoute,
  IconSearch,
  IconShieldCheck,
  IconShieldLock,
  IconShirt,
  IconSpeakerphone,
  IconStack2,
  IconTruckDelivery,
  IconUserShield,
  IconUsers,
  IconVideo,
  IconEyeOff,
  IconHeartHandshake,
} from '@tabler/icons-react';
import type { Capability } from './auth/roles';

type Icon = typeof IconHome;

export interface Destination {
  id: string;
  path: string;
  label: string;
  icon: Icon;
  capability: Capability;
}

export interface MenuSection {
  id: string;
  title?: string;
  icon?: Icon;
  place?: 'top' | 'bottom';
  items: Destination[];
}

/**
 * The menu, grouped by job. Who sees what is each entry's capability (auth/roles.ts), so the menu and the route
 * guards cannot disagree.
 */
export const MENU: MenuSection[] = [
  { id: 'home', place: 'top', items: [{ id: 'dashboard', path: '/', label: 'Dashboard', icon: IconHome, capability: 'viewDashboard' }] },
  {
    id: 'reviews',
    title: 'Reviews',
    icon: IconClipboardCheck,
    items: [
      { id: 'kyc', path: '/kyc', label: 'KYC & applications', icon: IconShieldCheck, capability: 'viewKyc' },
      { id: 'moderation', path: '/moderation', label: 'Moderation', icon: IconEyeOff, capability: 'viewModeration' },
    ],
  },
  {
    id: 'marketplace',
    title: 'Marketplace',
    icon: IconBuildingStore,
    items: [
      { id: 'vendors', path: '/vendors', label: 'Vendors', icon: IconBuildingStore, capability: 'viewVendors' },
      { id: 'products', path: '/products', label: 'Products', icon: IconShirt, capability: 'viewProducts' },
      { id: 'customers', path: '/customers', label: 'Customers', icon: IconUsers, capability: 'viewCustomers' },
      { id: 'riders', path: '/riders', label: 'Riders', icon: IconMotorbike, capability: 'viewRiders' },
    ],
  },
  {
    id: 'orders',
    title: 'Orders & money',
    icon: IconReceipt,
    items: [
      { id: 'orders', path: '/orders', label: 'Orders', icon: IconReceipt, capability: 'viewOrders' },
      { id: 'returns', path: '/returns', label: 'Returns', icon: IconReceiptRefund, capability: 'viewSupport' },
      { id: 'tickets', path: '/support', label: 'Support tickets', icon: IconHeadset, capability: 'viewSupport' },
      { id: 'payments', path: '/payments', label: 'Payments', icon: IconCreditCard, capability: 'viewPayouts' },
      { id: 'refunds', path: '/refunds', label: 'Refunds', icon: IconCashBanknote, capability: 'viewRefunds' },
      { id: 'payouts', path: '/payouts', label: 'Payouts', icon: IconCash, capability: 'viewPayouts' },
      { id: 'commission', path: '/commission', label: 'Commission', icon: IconPercentage, capability: 'viewPayouts' },
      { id: 'try-on', path: '/try-on', label: 'Virtual try-on', icon: IconCamera, capability: 'viewTryOn' },
      { id: 'care', path: '/order-care', label: 'Order care', icon: IconHeartHandshake, capability: 'orderCare' },
      { id: 'bookings', path: '/bookings', label: 'Service bookings', icon: IconCalendarCheck, capability: 'viewBookings' },
    ],
  },
  {
    id: 'delivery',
    title: 'Delivery',
    icon: IconTruckDelivery,
    items: [
      { id: 'delivery-ops', path: '/delivery', label: 'Delivery ops', icon: IconPackage, capability: 'viewDelivery' },
    ],
  },
  {
    id: 'content',
    title: 'Content & growth',
    icon: IconSpeakerphone,
    items: [
      { id: 'content', path: '/content', label: 'Reels & content', icon: IconVideo, capability: 'viewContent' },
      { id: 'journeys', path: '/journeys', label: 'Journeys', icon: IconRoute, capability: 'viewModeration' },
      { id: 'campaigns', path: '/campaigns', label: 'Campaigns', icon: IconSpeakerphone, capability: 'viewCatalogOps' },
      { id: 'collections', path: '/collections', label: 'Collections', icon: IconStack2, capability: 'viewCatalogOps' },
      { id: 'discovery', path: '/discovery', label: 'Discovery', icon: IconSearch, capability: 'viewCatalogOps' },
    ],
  },
  {
    id: 'platform',
    title: 'Platform',
    icon: IconAdjustments,
    items: [
      { id: 'flags', path: '/feature-flags', label: 'Feature flags', icon: IconFlag, capability: 'viewFlags' },
      { id: 'config', path: '/platform-config', label: 'Platform config', icon: IconLayoutGrid, capability: 'viewConfig' },
      { id: 'admins', path: '/admins', label: 'Admins & roles', icon: IconUserShield, capability: 'manageAdmins' },
      { id: 'audit', path: '/audit', label: 'Audit log', icon: IconHistory, capability: 'viewAudit' },
      { id: 'privacy', path: '/privacy', label: 'Privacy requests', icon: IconActivity, capability: 'viewDataRights' },
    ],
  },
  { id: 'me', place: 'bottom', items: [{ id: 'security', path: '/security', label: 'My security', icon: IconShieldLock, capability: 'viewDashboard' }] },
];

export function visibleMenu(can: (c: Capability) => boolean): MenuSection[] {
  return MENU.map((s) => ({ ...s, items: s.items.filter((d) => can(d.capability)) })).filter((s) => s.items.length > 0);
}

export function currentDestination(pathname: string): Destination | undefined {
  const all = MENU.flatMap((s) => s.items);
  // Longest matching prefix wins, so /orders/123 is Orders and / is only the dashboard.
  return all
    .filter((d) => (d.path === '/' ? pathname === '/' : pathname === d.path || pathname.startsWith(`${d.path}/`)))
    .sort((a, b) => b.path.length - a.path.length)[0];
}
