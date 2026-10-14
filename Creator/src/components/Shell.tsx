import { Suspense, useEffect, useState, type ReactNode, type ComponentType } from 'react';
import {
  ActionIcon,
  AppShell,
  Avatar,
  Badge,
  Box,
  Burger,
  Center,
  Collapse,
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
  IconActivity,
  IconAddressBook,
  IconBell,
  IconBriefcase,
  IconBuildingStore,
  IconCash,
  IconChartBar,
  IconChevronDown,
  IconDots,
  IconFileDescription,
  IconHeartHandshake,
  IconHome,
  IconLayoutGrid,
  IconLogout,
  IconMoon,
  IconMovie,
  IconMusic,
  IconPlugConnected,
  IconReceipt2,
  IconSettings,
  IconShieldLock,
  IconSparkles,
  IconSun,
  IconTrophy,
  IconUser,
  IconUsersGroup,
  IconWallet,
  type IconProps,
} from '@tabler/icons-react';
import { Link, matchPath, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from '../auth/session';
import { useAccount } from '../auth/useSession';
import { useNavBadges, type BadgeKey } from '../features/home/badges';
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
  badge?: BadgeKey;
}

export const NAV: { section?: string; items: NavItem[] }[] = [
  { items: [{ to: '/', label: 'Home', icon: IconHome, end: true }] },
  {
    section: 'Create',
    items: [
      { to: '/reels', label: 'Reels', icon: IconMovie },
      { to: '/studio', label: 'Studio', icon: IconSparkles },
      { to: '/analytics', label: 'Analytics', icon: IconChartBar },
    ],
  },
  {
    section: 'Brands & deals',
    items: [
      { to: '/partnerships', label: 'Partnerships', icon: IconHeartHandshake, badge: 'invites' },
      { to: '/briefs', label: 'Briefs & campaigns', icon: IconFileDescription },
      { to: '/brands', label: 'Find brands', icon: IconBuildingStore },
      { to: '/deals', label: 'Squads & retainers', icon: IconBriefcase },
      { to: '/rate-card', label: 'Rate card', icon: IconReceipt2 },
    ],
  },
  {
    section: 'Money',
    items: [
      { to: '/earnings', label: 'Earnings', icon: IconWallet },
      { to: '/payouts', label: 'Payouts', icon: IconCash },
    ],
  },
  {
    section: 'Profile',
    items: [
      { to: '/profile', label: 'Public profile', icon: IconUser },
      { to: '/collections', label: 'Collections', icon: IconLayoutGrid },
      { to: '/social', label: 'Social accounts', icon: IconPlugConnected },
      { to: '/growth', label: 'Tier & milestones', icon: IconTrophy },
    ],
  },
  {
    section: 'Community',
    items: [
      { to: '/community', label: 'Stories, drops & live', icon: IconUsersGroup },
      { to: '/audio', label: 'Audio library', icon: IconMusic },
    ],
  },
  {
    items: [
      { to: '/activity', label: 'Activity', icon: IconActivity, badge: 'unread' },
      { to: '/settings', label: 'Settings', icon: IconSettings },
    ],
  },
];

const GROUPS_KEY = 'sm.creator.nav.groups';

function readGroups(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(GROUPS_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

function isCurrent(item: NavItem, pathname: string): boolean {
  return matchPath({ path: item.to, end: item.end ?? false }, pathname) !== null;
}

/**
 * A sidebar category as a drop-down, like the Admin console's: every group starts open, a group the user folds
 * stays folded (this browser only), and a folded group holding the current page shows a dot. Untitled groups
 * (Home, Settings) render flat.
 */
function NavGroup({ title, holdsCurrent, children }: { title?: string; holdsCurrent: boolean; children: ReactNode }) {
  const [groups, setGroups] = useState<Record<string, boolean>>(readGroups);
  if (!title) return <div>{children}</div>;
  const open = groups[title] ?? true;
  const toggle = () => {
    const next = { ...readGroups(), [title]: !open };
    setGroups(next);
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
    } catch {
      // remembered for this visit only
    }
  };
  const panel = `nav-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className="sm-nav-group" data-open={open || undefined}>
      <UnstyledButton className="sm-nav-section" aria-expanded={open} aria-controls={panel} data-holds-current={holdsCurrent || undefined} onClick={toggle}>
        <span className="sm-nav-section-title">{title}</span>
        {!open && holdsCurrent && <span className="sm-nav-dot" aria-hidden />}
        <IconChevronDown size={14} className="sm-nav-chevron" aria-hidden />
      </UnstyledButton>
      <Collapse in={open} transitionDuration={140} id={panel} role="group" aria-label={title}>
        {children}
      </Collapse>
    </div>
  );
}

const TABS: NavItem[] = [
  { to: '/', label: 'Home', icon: IconHome, end: true },
  { to: '/reels', label: 'Reels', icon: IconMovie },
  { to: '/partnerships', label: 'Brands', icon: IconHeartHandshake, badge: 'invites' },
  { to: '/earnings', label: 'Earnings', icon: IconWallet },
];

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
  const badges = useNavBadges();
  const live = useLiveUpdates();

  useEffect(() => {
    close();
    window.scrollTo(0, 0);
  }, [location.pathname, close]);

  const name = account.data?.displayName ?? 'Creator';
  const contact = account.data?.primaryEmail ?? account.data?.primaryPhone ?? '';
  const badgeOf = (item: NavItem) => (item.badge ? (badges[item.badge] ?? 0) : 0);

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
              <UnstyledButton component={Link} to="/" aria-label="Creator Studio home" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <BrandMark size={32} />
                <div style={{ minWidth: 0 }}>
                  <Text fw={700} lh={1.15} style={{ letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                    StyleMint
                  </Text>
                  <Text size="xs" c={surfaces.textMuted} lh={1.15} style={{ whiteSpace: 'nowrap' }}>
                    Creator Studio
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
                          Creator
                        </Text>
                      </Box>
                      <IconChevronDown size={14} color="var(--sm-text-muted)" />
                    </Group>
                  </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{contact || name}</Menu.Label>
                  <Menu.Item leftSection={<IconUser size={15} />} component={Link} to="/profile">
                    Public profile
                  </Menu.Item>
                  <Menu.Item leftSection={<IconBell size={15} />} component={Link} to="/settings?tab=notifications">
                    Notifications
                  </Menu.Item>
                  <Menu.Item leftSection={<IconShieldLock size={15} />} component={Link} to="/settings">
                    Password & sessions
                  </Menu.Item>
                  <Menu.Item leftSection={<IconAddressBook size={15} />} component={Link} to="/social">
                    Social accounts
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
              {NAV.map((group, gi) => (
                <NavGroup key={gi} title={group.section} holdsCurrent={group.items.some((i) => isCurrent(i, location.pathname))}>
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
                </NavGroup>
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
