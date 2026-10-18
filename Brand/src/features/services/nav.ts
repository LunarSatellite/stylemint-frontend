import type { ComponentType } from 'react';
import {
  IconBed,
  IconBuildingBank,
  IconCalendarCheck,
  IconCalendarTime,
  IconInbox,
  IconMapPin,
  IconMap2,
  IconPigMoney,
  type IconProps,
} from '@tabler/icons-react';
import { ServiceCategory } from './category';

export interface ServiceNavItem {
  to: string;
  label: string;
  icon: ComponentType<IconProps>;
  end?: boolean;
}

/**
 * The sidebar group for a service vendor, by category. Product sellers (0) get none — their menu is unchanged.
 */
export function serviceNavFor(category: number): { section: string; items: ServiceNavItem[] } | null {
  switch (category) {
    case ServiceCategory.Hotel:
      return {
        section: 'Hotel',
        items: [
          { to: '/services/bookings', label: 'Bookings', icon: IconCalendarCheck },
          { to: '/services/listings', label: 'Property, rooms & rates', icon: IconBed },
        ],
      };
    case ServiceCategory.TravelAgency:
      return {
        section: 'Travel',
        items: [
          { to: '/services/bookings', label: 'Bookings', icon: IconCalendarCheck },
          { to: '/services/listings', label: 'Packages & departures', icon: IconMap2 },
        ],
      };
    case ServiceCategory.Bank:
      return {
        section: 'Bank',
        items: [
          { to: '/bank/leads', label: 'Leads', icon: IconInbox },
          { to: '/bank/appointments', label: 'Appointments', icon: IconCalendarTime },
          { to: '/bank/products', label: 'Bank products', icon: IconPigMoney },
          { to: '/bank/branches', label: 'Branches', icon: IconMapPin },
        ],
      };
    default:
      return null;
  }
}

/** Phone tab bar entries that replace Orders / Products for a service vendor. */
export function serviceTabsFor(category: number): ServiceNavItem[] | null {
  switch (category) {
    case ServiceCategory.Hotel:
      return [
        { to: '/services/bookings', label: 'Bookings', icon: IconCalendarCheck },
        { to: '/services/listings', label: 'Rooms', icon: IconBed },
      ];
    case ServiceCategory.TravelAgency:
      return [
        { to: '/services/bookings', label: 'Bookings', icon: IconCalendarCheck },
        { to: '/services/listings', label: 'Packages', icon: IconMap2 },
      ];
    case ServiceCategory.Bank:
      return [
        { to: '/bank/leads', label: 'Leads', icon: IconInbox },
        { to: '/bank/products', label: 'Products', icon: IconBuildingBank },
      ];
    default:
      return null;
  }
}
