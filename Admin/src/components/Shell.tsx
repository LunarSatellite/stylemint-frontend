import { Suspense, useEffect, useState } from 'react';
import { Alert, Anchor, AppShell, Avatar, Badge, Box, Burger, Center, Collapse, Group, Loader, Menu, ScrollArea, Stack, Text, UnstyledButton } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { meApi } from '@/api/admins';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconLogout, IconLogout2, IconShieldLock } from '@tabler/icons-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/guards';
import { roleLabel } from '@/auth/roles';
import { signOut } from '@/auth/session';
import { StepUpDialog } from '@/auth/StepUpDialog';
import { currentDestination, visibleMenu, type Destination, type MenuSection } from '@/navigation';
import { surfaces } from '@/theme';
import { BrandMark, ColorSchemeMenu, SkipToContent } from './Chrome';
import { ErrorBoundary } from './ErrorBoundary';
import { SessionExpiryWatcher } from './SessionExpiry';

function initialsOf(name: string | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const GROUPS_KEY = 'sm.admin.nav.groups';

function readGroups(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(GROUPS_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

/** The signed-in frame: header (brand, appearance, account), the two-level menu, and the page. As Voyager CX's. */
export function Shell() {
  const [opened, { toggle, close }] = useDisclosure();
  const { claims, can } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const sections = visibleMenu(can);
  const current = currentDestination(location.pathname);
  const [groups, setGroups] = useState<Record<string, boolean>>(readGroups);

  useEffect(() => {
    close();
  }, [location.pathname, close]);

  // Every group starts open (the menu is short enough to show whole); a group the operator folds stays folded.
  const isOpen = (s: MenuSection) => groups[s.id] ?? true;
  const toggleGroup = (s: MenuSection) => {
    const next = { ...groups, [s.id]: !isOpen(s) };
    setGroups(next);
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
    } catch {
      // remembered for this visit only
    }
  };

  const name = claims?.name || claims?.email || 'Admin';
  const top = sections.filter((s) => s.place === 'top');
  const bottom = sections.filter((s) => s.place === 'bottom');
  const middle = sections.filter((s) => !s.place);

  return (
    <>
      <SkipToContent />
      <AppShell header={{ height: 60 }} navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding="lg">
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Menu" aria-expanded={opened} aria-controls="main-menu" />
              <UnstyledButton component={Link} to="/" aria-label="StyleMint Admin - dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <BrandMark />
                <div>
                  <Text fw={700} lh={1.15} style={{ letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                    StyleMint Admin
                  </Text>
                  <Text size="xs" c={surfaces.textMuted} lh={1.15} visibleFrom="md" style={{ whiteSpace: 'nowrap' }}>
                    Marketplace operations
                  </Text>
                </div>
              </UnstyledButton>
            </Group>

            <Group gap="sm" wrap="nowrap">
              <ColorSchemeMenu />
              <Menu position="bottom-end" width={250}>
                <Menu.Target>
                  <UnstyledButton
                    aria-label={`Account menu for ${name}`}
                    style={{ padding: '5px 9px 5px 6px', borderRadius: 10, border: `1px solid ${surfaces.border}`, backgroundColor: surfaces.subtle }}
                  >
                    <Group gap={9} wrap="nowrap">
                      <Avatar size={28} radius="md" color="forest" variant="filled">
                        <Text size="xs" fw={700}>
                          {initialsOf(name)}
                        </Text>
                      </Avatar>
                      <Box visibleFrom="md" style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                        <Text size="sm" fw={600} lh={1.15}>
                          {name}
                        </Text>
                        <Text size="xs" c={surfaces.textMuted} lh={1.15}>
                          {claims?.roles[0] ? roleLabel(claims.roles[0]) : 'No role yet'}
                        </Text>
                      </Box>
                      <IconChevronDown size={14} color="var(--sm-text-muted)" />
                    </Group>
                  </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{claims?.email}</Menu.Label>
                  <Box px="sm" pb={6}>
                    <Group gap={4}>
                      {(claims?.roles ?? []).map((r) => (
                        <Badge key={r} size="xs" variant="light" color="forest">
                          {roleLabel(r)}
                        </Badge>
                      ))}
                    </Group>
                  </Box>
                  <Menu.Divider />
                  <Menu.Item leftSection={<IconShieldLock size={15} />} component={Link} to="/security">
                    My security
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconLogout2 size={15} />}
                    onClick={() => {
                      void signOut(true).then(() => navigate('/login', { replace: true }));
                    }}
                  >
                    Sign out everywhere
                  </Menu.Item>
                  <Menu.Item
                    color="signal"
                    leftSection={<IconLogout size={15} />}
                    onClick={() => {
                      void signOut(false).then(() => navigate('/login', { replace: true }));
                    }}
                  >
                    Sign out
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="sm" id="main-menu" aria-label="Main menu" component="nav">
          <ScrollArea style={{ flex: 1 }} type="hover" scrollbarSize={6}>
            <Stack gap={2} className="sm-sidebar">
              {top.flatMap((s) => s.items).map((d) => (
                <ItemLink key={d.id} d={d} level={1} active={current?.id === d.id} />
              ))}
              <Box className="sm-sidebar-rule" aria-hidden />
              {middle.map((s) => (
                <Group2 key={s.id} section={s} open={isOpen(s)} onToggle={() => toggleGroup(s)} currentId={current?.id} />
              ))}
              {bottom.length > 0 && <Box className="sm-sidebar-rule" aria-hidden />}
              {bottom.flatMap((s) => s.items).map((d) => (
                <ItemLink key={d.id} d={d} level={1} active={current?.id === d.id} />
              ))}
            </Stack>
          </ScrollArea>
          <Box visibleFrom="sm" mt="sm" p="sm" style={{ borderRadius: 12, border: `1px solid ${surfaces.border}`, backgroundColor: surfaces.subtle }}>
            <Text size="xs" c={surfaces.textMuted} lh={1.3}>
              Signed in as
            </Text>
            <Text size="sm" fw={600} lh={1.35} truncate>
              {(claims?.roles ?? []).map(roleLabel).join(', ') || 'No role yet'}
            </Text>
          </Box>
        </AppShell.Navbar>

        <AppShell.Main id="main-content" tabIndex={-1}>
          <ErrorBoundary resetKey={location.pathname}>
            <Suspense
              fallback={
                <Center mih="40vh">
                  <Loader size="sm" color="forest" />
                </Center>
              }
            >
              <Box maw={1480} mx="auto">
                <MfaNudge />
                <Outlet />
              </Box>
            </Suspense>
          </ErrorBoundary>
        </AppShell.Main>
      </AppShell>
      <StepUpDialog />
      <SessionExpiryWatcher />
    </>
  );
}

/**
 * Sensitive actions need two-step verification, which is enrolled in the console, not at the identity provider. A
 * Super Admin without it would only find out when a role change is refused, so say it up front.
 */
function MfaNudge() {
  const { can } = useAuth();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const relevant = can('manageAdmins') || can('forcePayouts');
  const mfa = useQuery({ queryKey: ['me', 'mfa'], queryFn: ({ signal }) => meApi.mfa(signal), enabled: relevant, staleTime: 5 * 60_000 });
  if (!relevant || dismissed || location.pathname === '/security' || !mfa.data || mfa.data.totpConfirmed) return null;
  return (
    <Alert color="amber" variant="light" mb="lg" withCloseButton onClose={() => setDismissed(true)} closeButtonLabel="Dismiss" icon={<IconShieldLock size={18} />} title="Set up two-step verification">
      Role changes, payout overrides and session resets ask for a code from your authenticator app.{' '}
      <Anchor component={Link} to="/security" size="sm">
        Set it up now
      </Anchor>
    </Alert>
  );
}

function Group2({ section, open, onToggle, currentId }: { section: MenuSection; open: boolean; onToggle: () => void; currentId?: string }) {
  const panel = `nav-${section.id}`;
  const holdsCurrent = section.items.some((d) => d.id === currentId);
  const Icon = section.icon;
  return (
    <div className="sm-group" data-open={open || undefined}>
      <UnstyledButton className="sm-group-head" aria-expanded={open} aria-controls={panel} data-holds-current={holdsCurrent || undefined} onClick={onToggle}>
        {Icon && <Icon size={18} stroke={holdsCurrent ? 2 : 1.7} aria-hidden />}
        <span className="sm-group-title">{section.title}</span>
        {!open && holdsCurrent && <span className="sm-group-dot" aria-hidden />}
        <IconChevronDown size={15} className="sm-chevron" aria-hidden />
      </UnstyledButton>
      <Collapse in={open} transitionDuration={140} id={panel} role="group" aria-label={section.title}>
        <div className="sm-group-items">
          {section.items.map((d) => (
            <ItemLink key={d.id} d={d} level={2} active={d.id === currentId} />
          ))}
        </div>
      </Collapse>
    </div>
  );
}

function ItemLink({ d, level, active }: { d: Destination; level: 1 | 2; active: boolean }) {
  const Icon = d.icon;
  return (
    <UnstyledButton component={Link} to={d.path} className={`sm-item sm-item-${level}`} aria-current={active ? 'page' : undefined} data-active={active || undefined}>
      {level === 1 && <Icon size={18} stroke={active ? 2 : 1.7} aria-hidden />}
      <span className="sm-item-label">{d.label}</span>
    </UnstyledButton>
  );
}
