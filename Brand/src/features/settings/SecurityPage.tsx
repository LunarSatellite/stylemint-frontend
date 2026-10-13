import { useState } from 'react';
import { Alert, Badge, Button, Card, Group, PasswordInput, Stack, Text } from '@mantine/core';
import { IconDeviceDesktop, IconDeviceMobile, IconLogout } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiError, messageOf } from '../../api/client';
import { authApi, type UserSession } from '../../auth/api';
import { passwordMeetsPolicy } from '../../auth/passwordPolicy';
import { signOutEverywhere } from '../../auth/session';
import { useSession } from '../../auth/useSession';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDateTime, fromNow } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import { PasswordRules } from '../auth/PasswordRules';

function ChangePasswordCard() {
  const { accountId } = useSession();
  const status = useQuery({ queryKey: ['registration-status', accountId], queryFn: () => authApi.registrationStatus(accountId!), enabled: !!accountId, retry: false });
  const hasPassword = status.data?.hasPassword ?? true;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => (hasPassword ? authApi.changePassword(accountId!, current, next) : authApi.createPassword(accountId!, next)),
    onSuccess: () => {
      toastSuccess(hasPassword ? 'Password changed' : 'Password created');
      setCurrent('');
      setNext('');
      setConfirm('');
      setError(null);
      void status.refetch();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 403) setError('Your current password is not right.');
      else setError(messageOf(e));
    },
  });

  const submit = () => {
    setError(null);
    if (hasPassword && !current) return setError('Enter your current password.');
    if (!passwordMeetsPolicy(next)) return setError('The new password does not meet all the rules.');
    if (next !== confirm) return setError('The new passwords do not match.');
    if (hasPassword && next === current) return setError('Choose a password different from the current one.');
    save.mutate();
  };

  return (
    <SectionCard title={hasPassword ? 'Change password' : 'Create a password'} description={hasPassword ? undefined : 'You sign in with a code, or with Google, Apple or Facebook, today. A password gives you another way in.'}>
      <Stack gap="sm" maw={420}>
        {error && (
          <Alert color="signal" variant="light" role="alert">
            {error}
          </Alert>
        )}
        {hasPassword && <PasswordInput label="Current password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.currentTarget.value)} />}
        <PasswordInput label="New password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.currentTarget.value)} />
        <PasswordRules value={next} />
        <PasswordInput label="Confirm new password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.currentTarget.value)} />
        <Group>
          <Button onClick={submit} loading={save.isPending}>
            {hasPassword ? 'Change password' : 'Create password'}
          </Button>
        </Group>
      </Stack>
    </SectionCard>
  );
}

function deviceOf(s: UserSession) {
  const ua = s.userAgent ?? '';
  const mobile = /Android|iPhone|iPad|Dart|okhttp|StyleMint/i.test(ua);
  const name = /Dart|okhttp|StyleMint/i.test(ua)
    ? 'StyleMint app'
    : /Edg\//.test(ua)
      ? 'Edge'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Device';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return { mobile, label: os ? `${name} on ${os}` : name };
}

function SessionsCard() {
  const { accountId, sessionId } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const sessions = useQuery({ queryKey: ['sessions', accountId], queryFn: () => authApi.sessions(accountId!), enabled: !!accountId });
  const revoke = useMutation({
    mutationFn: (id: string) => authApi.revokeSession(accountId!, id),
    onSuccess: () => {
      toastSuccess('Signed out of that device');
      void qc.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (e) => toastError(e),
  });
  const everywhere = async () => {
    const ok = await confirmAction({
      title: 'Sign out everywhere?',
      body: 'You are signed out on every device, including the StyleMint app and this browser.',
      confirmLabel: 'Sign out everywhere',
      danger: true,
    });
    if (!ok) return;
    try {
      await signOutEverywhere();
    } catch {
      // Signed out locally regardless.
    }
    navigate('/login', { replace: true });
  };
  const list = (sessions.data ?? []).filter((s) => s.status === 1).sort((a, b) => Number(b.id === sessionId) - Number(a.id === sessionId));
  return (
    <SectionCard
      title="Where you are signed in"
      action={
        <Button size="xs" variant="light" color="signal" leftSection={<IconLogout size={14} />} onClick={() => void everywhere()}>
          Sign out everywhere
        </Button>
      }
    >
      {sessions.isPending ? (
        <ListSkeleton rows={3} height={48} />
      ) : sessions.error ? (
        <ErrorBlock error={sessions.error} onRetry={() => void sessions.refetch()} title="Could not load your sessions" />
      ) : list.length === 0 ? (
        <EmptyBlock title="No active sessions" />
      ) : (
        <Stack gap="xs">
          {list.map((s) => {
            const d = deviceOf(s);
            const current = s.id === sessionId;
            return (
              <Card key={s.id} padding="sm" withBorder>
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    {d.mobile ? <IconDeviceMobile size={22} /> : <IconDeviceDesktop size={22} />}
                    <div style={{ minWidth: 0 }}>
                      <Group gap={6}>
                        <Text size="sm" fw={600}>
                          {d.label}
                        </Text>
                        {current && (
                          <Badge size="xs" color="forest">
                            This browser
                          </Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed">
                        Active {fromNow(s.lastActivityUtc)} · signed in {formatDateTime(s.issuedUtc)}
                        {s.ipAddress ? ` · ${s.ipAddress}` : ''}
                      </Text>
                    </div>
                  </Group>
                  {!current && (
                    <Button size="xs" variant="subtle" color="signal" loading={revoke.isPending && revoke.variables === s.id} onClick={() => revoke.mutate(s.id)}>
                      Sign out
                    </Button>
                  )}
                </Group>
              </Card>
            );
          })}
        </Stack>
      )}
    </SectionCard>
  );
}

export default function SecurityPage() {
  return (
    <>
      <PageHeader title="Password & sessions" back={{ to: '/settings', label: 'Store settings' }} />
      <Stack gap="md">
        <ChangePasswordCard />
        <SessionsCard />
      </Stack>
    </>
  );
}
