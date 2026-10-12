import { useState } from 'react';
import { Alert, Badge, Button, Code, Group, PinInput, Skeleton, Stack, Table, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconDeviceMobile, IconShieldCheck } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { meApi, type AdminMfaEnrollment } from '@/api/admins';
import { messageOf } from '@/api/errors';
import { useAuth } from '@/auth/guards';
import { roleLabel } from '@/auth/roles';
import { signOut } from '@/auth/session';
import { useActionDialog } from '@/components/ActionDialog';
import { FieldGrid, When } from '@/components/Bits';
import { PageHeader } from '@/components/PageHeader';
import { ErrorBlock, SectionCard } from '@/components/StateBlocks';

/** The operator's own account: roles, two-step verification (needed for sensitive actions) and open sessions. */
export function SecurityPage() {
  const { claims } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const mfa = useQuery({ queryKey: ['me', 'mfa'], queryFn: ({ signal }) => meApi.mfa(signal) });
  const sessions = useQuery({ queryKey: ['me', 'sessions'], queryFn: ({ signal }) => meApi.sessions(signal) });
  const [enrollment, setEnrollment] = useState<AdminMfaEnrollment | null>(null);
  const [code, setCode] = useState('');

  const enroll = useMutation({ mutationFn: () => meApi.enrollTotp('StyleMint Admin'), onSuccess: setEnrollment });
  const confirm = useMutation({
    mutationFn: (value: string) => meApi.confirmTotp(value),
    onSuccess: () => {
      notifications.show({ color: 'forest', title: 'Two-step verification is on', message: 'Sensitive actions will ask for a code from your app.' });
      setEnrollment(null);
      setCode('');
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  return (
    <>
      {dialog}
      <PageHeader title="My security" description="Two-step verification protects role changes, payout overrides and other sensitive actions." />
      <Stack gap="lg">
        <SectionCard title="You">
          <FieldGrid
            fields={[
              { label: 'Name', value: claims?.name },
              { label: 'Email', value: claims?.email },
              {
                label: 'Roles',
                value: (
                  <Group gap={4}>
                    {(claims?.roles ?? []).map((r) => (
                      <Badge key={r} variant="light">
                        {roleLabel(r)}
                      </Badge>
                    ))}
                  </Group>
                ),
              },
              { label: 'This session ends', value: claims ? <When value={new Date(claims.exp * 1000).toISOString()} /> : null },
            ]}
          />
        </SectionCard>

        <SectionCard title="Two-step verification" description="An authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) generates the codes.">
          {mfa.isLoading ? (
            <Skeleton height={60} radius="md" />
          ) : mfa.error ? (
            <ErrorBlock error={mfa.error} onRetry={() => void mfa.refetch()} />
          ) : mfa.data?.totpConfirmed ? (
            <Stack gap="sm">
              <Group gap="sm">
                <IconShieldCheck size={20} color="var(--mantine-color-forest-7)" aria-hidden />
                <Text size="sm" fw={600}>
                  On
                </Text>
                {mfa.data.totpLocked && <Badge color="signal">Locked for 15 minutes after wrong codes</Badge>}
                {mfa.data.sessionStepUpFresh && (
                  <Badge color="forest" variant="light">
                    Confirmed in the last {mfa.data.stepUpMaxAgeMinutes} minutes
                  </Badge>
                )}
              </Group>
              <Text size="sm" c="dimmed">
                Last used <When value={mfa.data.totpLastVerifiedUtc} relative />.
              </Text>
              <Group>
                <Button
                  variant="light"
                  color="signal"
                  size="xs"
                  onClick={() =>
                    open({
                      title: 'Turn off two-step verification',
                      consequence: 'You will not be able to do sensitive actions until you set it up again. You will be asked for a current code first.',
                      confirmLabel: 'Turn off',
                      danger: true,
                      run: () => meApi.removeTotp(),
                      success: 'Two-step verification removed.',
                      onDone: () => void queryClient.invalidateQueries({ queryKey: ['me'] }),
                    })
                  }
                >
                  Turn off…
                </Button>
              </Group>
            </Stack>
          ) : enrollment ? (
            <Stack gap="md" maw={520}>
              <Text size="sm">
                1. In your authenticator app, add an account and choose <b>enter a setup key</b>. Use this key (time-based, {enrollment.digits} digits):
              </Text>
              <Code block style={{ fontSize: 16, letterSpacing: 2, wordBreak: 'break-all' }}>
                {enrollment.secretBase32.replace(/(.{4})/g, '$1 ').trim()}
              </Code>
              <Text size="xs" c="dimmed">
                On a phone, you can open the setup link directly:{' '}
                <a href={enrollment.provisioningUri} rel="noreferrer">
                  add to authenticator
                </a>
                . The key is shown once - don’t screenshot it.
              </Text>
              <Text size="sm">2. Enter the {enrollment.digits}-digit code the app shows:</Text>
              <PinInput length={enrollment.digits} type="number" oneTimeCode value={code} onChange={setCode} onComplete={(v) => confirm.mutate(v)} aria-label="Code from your authenticator" />
              {confirm.error && (
                <Alert color="signal" variant="light" role="alert">
                  {messageOf(confirm.error)}
                </Alert>
              )}
              <Group>
                <Button loading={confirm.isPending} disabled={code.length < enrollment.digits} onClick={() => confirm.mutate(code)}>
                  Turn on
                </Button>
                <Button variant="default" onClick={() => setEnrollment(null)}>
                  Cancel
                </Button>
              </Group>
            </Stack>
          ) : (
            <Stack gap="sm">
              <Alert color="amber" variant="light" icon={<IconDeviceMobile size={16} />}>
                Not set up. You can read and do routine work, but role changes, payout overrides and similar actions will be refused until you set it up.
              </Alert>
              {enroll.error && (
                <Text size="sm" c="signal">
                  {messageOf(enroll.error)}
                </Text>
              )}
              <Group>
                <Button onClick={() => enroll.mutate()} loading={enroll.isPending}>
                  Set up two-step verification
                </Button>
              </Group>
            </Stack>
          )}
        </SectionCard>

        <SectionCard
          title="Where you’re signed in"
          action={
            <Button size="xs" variant="light" color="signal" onClick={() => void signOut(true).then(() => navigate('/login', { replace: true }))}>
              Sign out everywhere
            </Button>
          }
        >
          {sessions.isLoading ? (
            <Skeleton height={60} radius="md" />
          ) : sessions.error ? (
            <ErrorBlock error={sessions.error} onRetry={() => void sessions.refetch()} />
          ) : (
            <Table.ScrollContainer minWidth={520}>
              <Table aria-label="Your sessions">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Started</Table.Th>
                    <Table.Th>Last seen</Table.Th>
                    <Table.Th>From</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(sessions.data ?? []).map((s) => (
                    <Table.Tr key={s.id}>
                      <Table.Td>
                        <When value={s.issuedUtc} />
                      </Table.Td>
                      <Table.Td>
                        <When value={s.lastSeenUtc} relative />
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" lineClamp={1} title={s.userAgent}>
                          {s.sourceIp} · {s.userAgent}
                        </Text>
                      </Table.Td>
                      <Table.Td>{s.jti === claims?.jti && <Badge size="sm">This browser</Badge>}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </SectionCard>
      </Stack>
    </>
  );
}
