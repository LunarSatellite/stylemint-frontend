import { Suspense, useEffect, useMemo, type ComponentType } from 'react';
import {
  ActionIcon,
  AppShell,
  Avatar,
  Badge,
  Box,
  Burger,
  Center,
  Group,
  Loader,
  Menu,
  ScrollArea,
  Text,
  Tooltip,
  UnstyledButton,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBuildingStore,
  IconCalendarEvent,
  IconCash,
  IconChartBar,
  IconChartLine,
  IconHeart,
  IconMovie,
  IconSearch,
  IconShirt,
  IconTag,
  IconUserStar,
  IconChevronDown,
  IconDots,
  IconHome,
  IconLifebuoy,
  IconBriefcase,
  IconMessageStar,
  IconSpeakerphone,
  IconUsers,
  IconUsersGroup,
  IconLogout,
  IconMoon,
  IconPackage,
  IconReceipt,
  IconSettings,
  IconShieldLock,
  IconSun,
  IconTruckDelivery,
  type IconProps,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from '../auth/session';
import { useAccount } from '../auth/useSession';
import { useCrmSession, useVisibleAreas } from '../features/crm/hooks';
import type { CrmAreaKey } from '../features/crm/roles';
import { INSIGHTS_SECTIONS, type InsightsSectionKey } from '../features/insights/sections';
import { crmSession } from '../features/crm/session';
import { ordersApi } from '../features/orders/api';
import { useLiveUpdates } from '../lib/live';
import { initialsOf } from '../lib/format';
import { surfaces } from '../theme';
import { BrandMark } from './BrandMark';
import { ErrorBoundary } from './ErrorBoundary';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<IconProps>;
  end?: boolean;
  badge?: 'newOrders';
}

const NAV: { section?: string; items: NavItem[] }[] = [
  { items: [{ to: '/', label: 'Home', icon: IconHome, end: true }] },
  {
    section: 'Sell',
    items: [
      { to: '/orders', label: 'Orders', icon: IconReceipt, badge: 'newOrders' },
      { to: '/products', label: 'Products', icon: IconPackage },
      { to: '/delivery', label: 'Delivery', icon: IconTruckDelivery },
      { to: '/care', label: 'Returns & questions', icon: IconLifebuoy },
    ],
  },
  {
    section: 'Money & shop',
    items: [
      { to: '/payouts', label: 'Payouts & earnings', icon: IconCash },
      { to: '/settings', label: 'Store settings', icon: IconSettings },
    ],
  },
];

const CRM_ICONS: Record<CrmAreaKey, ComponentType<IconProps>> = {
  customers: IconUsers,
  tasks: IconCalendarEvent,
  segments: IconUsersGroup,
  campaigns: IconSpeakerphone,
  feedback: IconMessageStar,
  deals: IconBriefcase,
  reports: IconChartBar,
};

const INSIGHTS_ICONS: Record<InsightsSectionKey, ComponentType<IconProps>> = {
  sales: IconChartLine,
  products: IconShirt,
  demand: IconSearch,
  reels: IconMovie,
  creators: IconUserStar,
  promotions: IconTag,
  customers: IconHeart,
};

const INSIGHTS_GROUP: { section?: string; items: NavItem[] } = {
  section: 'Insights',
  items: INSIGHTS_SECTIONS.map((s) => ({ to: s.to, label: s.label, icon: INSIGHTS_ICONS[s.key] })),
};

// Payouts stays one tap away in "More" (the sidebar); Insights takes its place in the tab bar.
const TABS: NavItem[] = [
  { to: '/', label: 'Home', icon: IconHome, end: true },
  { to: '/orders', label: 'Orders', icon: IconReceipt, badge: 'newOrders' },
  { to: '/products', label: 'Products', icon: IconPackage },
  { to: '/crm', label: 'Customers', icon: IconUsers },
  { to: '/insights', label: 'Insights', icon: IconChartLine },
];

/** The sidebar: fixed groups plus the CRM group, which follows the seller's CRM role. */
function useNav() {
  const crmAreas = useVisibleAreas();
  return useMemo(() => {
    const crmGroup: { section?: string; items: NavItem[] } = {
      section: 'Customers & CRM',
      items: crmAreas.map((a) => ({ to: a.to, label: a.label, icon: CRM_ICONS[a.key] })),
    };
    return [NAV[0], NAV[1], INSIGHTS_GROUP, crmGroup, ...NAV.slice(2)];
  }, [crmAreas]);
}

/** Learn the CRM role shortly after the shell opens, so the CRM menu shows only what the role can use. */
function usePrefetchCrmSession() {
  const { status } = useCrmSession();
  useEffect(() => {
    if (status !== 'idle') return;
    const t = setTimeout(() => {
      if (crmSession.getState().status === 'idle') void crmSession.acquire();
    }, 1500);
    return () => clearTimeout(t);
  }, [status]);
}

function useNewOrderCount() {
  return useQuery({
    queryKey: ['orders', 'count', 'new'],
    queryFn: () => ordersApi.count([2, 3]),
    refetchInterval: 60_000,
    staleTime: 20_000,
  });
}

function ColorSchemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  return (
    <Tooltip label={dark ? 'Light mode' : 'Dark mode'}>
      <ActionIcon
        variant="subtle"
        color="slate"
        size="lg"
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={() => setColorScheme(dark ? 'light' : 'dark')}
      >
        {dark ? <IconSun size={19} /> : <IconMoon size={19} />}
      </ActionIcon>
    </Tooltip>
  );
}

export function Shell() {
  const [opened, { toggle, close }] = useDisclosure();
  const location = useLocation();
  const navigate = useNavigate();
  const account = useAccount();
  const newOrders = useNewOrderCount();
  const live = useLiveUpdates();
  const nav = useNav();
  usePrefetchCrmSession();

  useEffect(() => {
    close();
    window.scrollTo(0, 0);
  }, [location.pathname, close]);

  const name = account.data?.displayName ?? 'Seller';
  const contact = account.data?.primaryEmail ?? account.data?.primaryPhone ?? '';
  const badgeOf = (item: NavItem) => (item.badge === 'newOrders' && newOrders.data ? newOrders.data : 0);

  return (
    <>
      <a
        className="sm-skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to content
      </a>
      <AppShell header={{ height: 60 }} navbar={{ width: 256, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding="md">
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
              <Burger
                opened={opened}
                onClick={toggle}
                hiddenFrom="sm"
                size="sm"
                aria-label="Menu"
                aria-expanded={opened}
                aria-controls="main-menu"
              />
              <UnstyledButton component={Link} to="/" aria-label="Seller Center home" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <BrandMark size={32} />
                <div style={{ minWidth: 0 }}>
                  <Text fw={700} lh={1.15} style={{ letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                    StyleMint
                  </Text>
                  <Text size="xs" c={surfaces.textMuted} lh={1.15} style={{ whiteSpace: 'nowrap' }}>
                    Seller Center
                  </Text>
                </div>
              </UnstyledButton>
            </Group>

            <Group gap="xs" wrap="nowrap">
              <Tooltip label={live === 'connected' ? 'Live updates on' : 'Updating every few seconds'}>
                <Box
                  aria-label={live === 'connected' ? 'Live updates on' : 'Live updates off'}
                  role="status"
                  w={8}
                  h={8}
                  style={{
                    borderRadius: 4,
                    background: live === 'connected' ? 'var(--mantine-color-forest-5)' : 'var(--mantine-color-slate-3)',
                  }}
                />
              </Tooltip>
              <ColorSchemeToggle />
              <Menu position="bottom-end" width={240}>
                <Menu.Target>
                  <UnstyledButton
                    aria-label={`Account menu for ${name}`}
                    style={{
                      padding: '5px 9px 5px 6px',
                      borderRadius: 10,
                      border: `1px solid ${surfaces.border}`,
                      backgroundColor: surfaces.subtle,
                    }}
                  >
                    <Group gap={9} wrap="nowrap">
                      <Avatar size={28} radius="md" color="forest" variant="filled" src={account.data?.avatarUrl ?? undefined}>
                        <Text size="xs" fw={700}>
                          {initialsOf(name)}
                        </Text>
                      </Avatar>
                      <Box visibleFrom="md" style={{ textAlign: 'left', whiteSpace: 'nowrap', maxWidth: 160 }}>
                        <Text size="sm" fw={600} lh={1.15} truncate>
                          {name}
                        </Text>
                        <Text size="xs" c={surfaces.textMuted} lh={1.15}>
                          Seller
                        </Text>
                      </Box>
                      <IconChevronDown size={14} color="var(--sm-text-muted)" />
                    </Group>
                  </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{contact || name}</Menu.Label>
                  <Menu.Item leftSection={<IconBuildingStore size={15} />} component={Link} to="/settings">
                    Store settings
                  </Menu.Item>
                  <Menu.Item leftSection={<IconShieldLock size={15} />} component={Link} to="/settings/security">
                    Password & sessions
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    color="signal"
                    leftSection={<IconLogout size={15} />}
                    onClick={() => {
                      void signOut().then(() => navigate('/login', { replace: true }));
                    }}
                  >
                    Sign out
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="sm" id="main-menu" aria-label="Main menu">
          <ScrollArea style={{ flex: 1 }} type="hover" scrollbarSize={6}>
            <nav>
              {nav.map((group, gi) => (
                <div key={gi}>
                  {group.section && <div className="sm-nav-section">{group.section}</div>}
                  {group.items.map((item) => {
                    const badge = badgeOf(item);
                    return (
                      // NavLink sets aria-current="page" on the active item; the CSS rail keys off it.
                      <NavLink key={item.to} to={item.to} end={item.end} className="sm-nav-item">
                        {({ isActive }) => (
                          <>
                            <item.icon size={18} stroke={isActive ? 2 : 1.7} aria-hidden />
                            <span className="sm-nav-label">{item.label}</span>
                            {badge > 0 && (
                              <Badge size="sm" color="signal" variant="filled" aria-label={`${badge} new`}>
                                {badge > 99 ? '99+' : badge}
                              </Badge>
                            )}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              ))}
            </nav>
          </ScrollArea>
          <Box
            visibleFrom="sm"
            mt="sm"
            p="sm"
            style={{ borderRadius: 12, border: `1px solid ${surfaces.border}`, backgroundColor: surfaces.subtle }}
          >
            <Text size="xs" c={surfaces.textMuted} lh={1.3}>
              Signed in as
            </Text>
            <Text size="sm" fw={600} lh={1.35} truncate>
              {name}
            </Text>
          </Box>
        </AppShell.Navbar>

        <AppShell.Main id="main-content" tabIndex={-1} className="sm-main-pad">
          <Box maw={1240} mx="auto">
            <ErrorBoundary resetKey={location.pathname}>
              <Suspense
                fallback={
                  <Center mih="40vh">
                    <Loader size="sm" color="forest" />
                  </Center>
                }
              >
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </Box>
        </AppShell.Main>
      </AppShell>

      <nav className="sm-tabbar" aria-label="Quick navigation">
        {TABS.map((tab) => {
          const badge = badgeOf(tab);
          return (
            <NavLink key={tab.to} to={tab.to} end={tab.end}>
              {({ isActive }) => (
                <>
                  <span style={{ position: 'relative', display: 'inline-flex' }}>
                    <tab.icon size={22} stroke={isActive ? 2 : 1.6} aria-hidden />
                    {badge > 0 && (
                      <Badge
                        size="xs"
                        color="signal"
                        variant="filled"
                        circle
                        style={{ position: 'absolute', top: -6, right: -12 }}
                        aria-label={`${badge} new`}
                      >
                        {badge > 9 ? '9+' : badge}
                      </Badge>
                    )}
                  </span>
                  <span>{tab.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
        <button type="button" onClick={toggle} aria-label="More pages" aria-expanded={opened} aria-controls="main-menu">
          <IconDots size={22} stroke={1.6} aria-hidden />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
