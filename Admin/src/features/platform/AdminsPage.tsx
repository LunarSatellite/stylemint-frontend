import { Alert, Badge, Button, Checkbox, Group, Skeleton, Stack, Table, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { IconShieldLock, IconUserPlus } from '@tabler/icons-react';
import { ADMIN_STATE_LABEL, adminsApi, ROLE_BY_NUMBER, SIGN_IN_METHOD_LABEL, signInMethodsOf, type AdminAccount } from '@/api/admins';
import { messageOf } from '@/api/errors';
import { useAuth } from '@/auth/guards';
import { ADMIN_ROLES, ROLE_DESCRIPTIONS, roleLabel } from '@/auth/roles';
import { withStepUp } from '@/auth/stepUp';
import { useActionDialog } from '@/components/ActionDialog';
import { FieldGrid, IdText, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { PageHeader } from '@/components/PageHeader';
import { ErrorBlock, SectionCard } from '@/components/StateBlocks';
import { useListState } from '@/hooks/useListState';
import { InviteAdminDialog } from './InviteAdminDialog';

const roleNames = (a: AdminAccount) => (a.roles ?? []).map((r) => ROLE_BY_NUMBER[r.role] ?? String(r.role));

/**
 * Admin accounts and their roles. Every change here asks for your authenticator code (step-up), and a role change
 * reaches the person's console the next time they sign in - their current session keeps its old roles.
 */
export function AdminsPage() {
  const list = useListState([] as const, { pageSize: 50 });
  const queryClient = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const q = useQuery({ queryKey: ['admins', list.page, list.pageSize], queryFn: ({ signal }) => adminsApi.list(list.page, list.pageSize, signal), placeholderData: keepPreviousData });
  const columns: Column<AdminAccount>[] = [
    { key: 'name', header: 'Admin', render: (a) => <TwoLine primary={a.displayName} secondary={a.email} /> },
    {
      key: 'roles',
      header: 'Roles',
      render: (a) =>
        (a.roles ?? []).length === 0 ? (
          <Badge color="amber" variant="light">
            No role - waiting for access
          </Badge>
        ) : (
          <Group gap={4}>
            {roleNames(a).map((r) => (
              <Badge key={r} size="sm" variant="light" color={r === 'SuperAdmin' ? 'signal' : 'forest'}>
                {roleLabel(r)}
              </Badge>
            ))}
          </Group>
        ),
    },
    { key: 'state', header: 'State', render: (a) => <Badge variant="dot" color={a.state === 1 ? 'forest' : 'gray'}>{ADMIN_STATE_LABEL[a.state]}</Badge> },
    { key: 'methods', header: 'Sign-in methods', visibleFrom: 'md', render: (a) => <SignInMethods admin={a} /> },
    {
      key: 'login',
      header: 'Last sign-in',
      visibleFrom: 'md',
      render: (a) => (
        <TwoLine
          primary={<When value={a.lastSignInUtc ?? a.lastLoginUtc} relative />}
          secondary={a.lastSignInMethod ? `with ${SIGN_IN_METHOD_LABEL[a.lastSignInMethod.toLowerCase()] ?? a.lastSignInMethod}` : undefined}
        />
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="Admins & roles"
        description="Who can use this console and what they can do. Invite someone by email - they sign in with Google, Facebook or a password on that address. People who arrive through single sign-on appear here with no role."
        actions={
          <Button leftSection={<IconUserPlus size={16} />} onClick={() => setInviting(true)}>
            Invite admin
          </Button>
        }
      />
      <InviteAdminDialog opened={inviting} onClose={() => setInviting(false)} onInvited={() => void queryClient.invalidateQueries({ queryKey: ['admins'] })} />
      <DataTable
        label="Admin accounts"
        columns={columns}
        page={q.data}
        isLoading={q.isLoading}
        isFetching={q.isFetching}
        error={q.error}
        onRetry={() => void q.refetch()}
        rowKey={(a) => a.id}
        onRowClick={(a) => list.open(a.id)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        emptyTitle="No admins"
      />
      <AdminDrawer admin={q.data?.items.find((a) => a.id === list.selected) ?? null} opened={!!list.selected} onClose={() => list.open(null)} />
    </>
  );
}

function AdminDrawer({ admin: a, opened, onClose }: { admin: AdminAccount | null; opened: boolean; onClose: () => void }) {
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const sessions = useQuery({ queryKey: ['admins', 'sessions', a?.id], queryFn: ({ signal }) => adminsApi.sessions(a!.id, signal), enabled: !!a });
  const self = a?.id === claims?.adminAccountId;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['admins'] });
  const held = new Set(a ? roleNames(a) : []);

  const toggleRole = useMutation({
    mutationFn: ({ role, grant }: { role: string; grant: boolean }) => withStepUp(() => (grant ? adminsApi.grantRole(a!.id, role) : adminsApi.revokeRole(a!.id, role))),
    onSuccess: (_r, v) => {
      notifications.show({ color: 'forest', title: v.grant ? 'Role granted' : 'Role removed', message: `${roleLabel(v.role)} - takes effect at their next sign-in.` });
      refresh();
    },
    onError: (e) => notifications.show({ color: 'signal', title: 'Role not changed', message: messageOf(e) }),
  });

  return (
    <DetailDrawer
      opened={opened}
      onClose={onClose}
      title={a?.displayName ?? 'Admin'}
      subtitle={a?.email}
      badges={a && <Badge variant="dot" color={a.state === 1 ? 'forest' : 'gray'}>{ADMIN_STATE_LABEL[a.state]}</Badge>}
      actions={
        a && (
          <>
            {!self &&
              (a.state === 1 ? (
                <Button
                  size="sm"
                  variant="light"
                  color="signal"
                  onClick={() =>
                    open({
                      title: `Disable ${a.displayName}`,
                      consequence: 'They can no longer sign in. Sessions already open stay valid until they expire - end them too with “End all sessions”.',
                      confirmLabel: 'Disable account',
                      danger: true,
                      run: () => adminsApi.disable(a.id),
                      success: 'Account disabled.',
                      onDone: refresh,
                    })
                  }
                >
                  Disable
                </Button>
              ) : (
                <Button size="sm" onClick={() => open({ title: `Enable ${a.displayName}`, consequence: 'They can sign in again with their roles.', confirmLabel: 'Enable account', run: () => adminsApi.enable(a.id), success: 'Account enabled.', onDone: refresh })}>
                  Enable
                </Button>
              ))}
            <Button
              size="sm"
              variant="default"
              onClick={() =>
                open({
                  title: `End all of ${a.displayName}’s sessions`,
                  consequence: 'Every browser they are signed in on is signed out at its next request.',
                  confirmLabel: 'End sessions',
                  danger: true,
                  fields: [{ name: 'reason', kind: 'textarea', label: 'Reason (audit log)', required: true, minLength: 5 }],
                  run: (v) => adminsApi.revokeAllSessions(a.id, v.reason!.trim()),
                  success: (n) => `${Number(n) || 0} session(s) ended.`,
                  onDone: refresh,
                })
              }
            >
              End all sessions
            </Button>
            <Button
              size="sm"
              variant="default"
              leftSection={<IconShieldLock size={16} />}
              onClick={() =>
                open({
                  title: `Reset ${a.displayName}’s two-step verification`,
                  consequence: 'Removes their authenticator so they can enrol a new one - for a lost phone or a lock-out. Confirm who you are talking to first.',
                  confirmLabel: 'Reset authenticator',
                  danger: true,
                  fields: [{ name: 'reason', kind: 'textarea', label: 'Reason (audit log)', required: true, minLength: 5 }],
                  run: (v) => adminsApi.removeMfa(a.id, v.reason!.trim()),
                  success: 'Authenticator removed.',
                  onDone: refresh,
                })
              }
            >
              Reset 2-step
            </Button>
          </>
        )
      }
    >
      {dialog}
      {a && (
        <Stack gap="lg">
          <Alert variant="light" color="slate" icon={<IconShieldLock size={16} />}>
            Changes on this page ask for your authenticator code. Role changes apply when the person next signs in.
          </Alert>
          <SectionCard title="Roles">
            <Stack gap="xs">
              {ADMIN_ROLES.map((r) => (
                <Checkbox
                  key={r}
                  label={roleLabel(r)}
                  description={ROLE_DESCRIPTIONS[r]}
                  checked={held.has(r)}
                  disabled={toggleRole.isPending || (self && r === 'SuperAdmin')}
                  onChange={(e) => toggleRole.mutate({ role: r, grant: e.currentTarget.checked })}
                />
              ))}
              {self && (
                <Text size="xs" c="dimmed">
                  You can’t remove your own Super Admin role here.
                </Text>
              )}
            </Stack>
          </SectionCard>
          <SectionCard title="Account">
            <FieldGrid
              fields={[
                { label: 'Email', value: a.email },
                { label: 'Signs in with', value: <SignInMethods admin={a} /> },
                { label: 'Last sign-in', value: <When value={a.lastSignInUtc ?? a.lastLoginUtc} /> },
                { label: 'Created', value: <When value={a.createdUtc} /> },
                { label: 'Admin ID', value: <IdText value={a.id} /> },
              ]}
            />
          </SectionCard>
          <SectionCard title="Open sessions">
            {sessions.isLoading ? (
              <Skeleton height={60} radius="md" />
            ) : sessions.error ? (
              <ErrorBlock error={sessions.error} onRetry={() => void sessions.refetch()} />
            ) : !sessions.data?.length ? (
              <Text size="sm" c="dimmed">
                No open sessions.
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={480}>
                <Table aria-label="Open sessions">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Started</Table.Th>
                      <Table.Th>Last seen</Table.Th>
                      <Table.Th>From</Table.Th>
                      <Table.Th>Expires</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {sessions.data.map((s) => (
                      <Table.Tr key={s.id}>
                        <Table.Td>
                          <When value={s.issuedUtc} />
                        </Table.Td>
                        <Table.Td>
                          <When value={s.lastSeenUtc} relative />
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" lineClamp={1} title={s.userAgent}>
                            {s.sourceIp}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <When value={s.expiresUtc} relative />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </SectionCard>
        </Stack>
      )}
    </DetailDrawer>
  );
}

/** Google / Facebook / Password / SSO, from the server's `signInMethods` - a dash until that field exists. */
function SignInMethods({ admin }: { admin: AdminAccount }) {
  const methods = signInMethodsOf(admin);
  if (!methods || methods.length === 0) return <Text span c="dimmed">—</Text>;
  return (
    <Group gap={4}>
      {methods.map((m) => (
        <Badge key={m} size="sm" variant="outline" color="slate">
          {m}
        </Badge>
      ))}
    </Group>
  );
}
