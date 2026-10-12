import { useState, type FormEvent } from 'react';
import { Alert, Anchor, Box, Button, Card, Collapse, Divider, Group, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle, IconKey, IconLogin2 } from '@tabler/icons-react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ApiError, messageOf } from '@/api/errors';
import { getConfig } from '@/config';
import { safeReturnTo, startSignIn } from '@/auth/oidc';
import { signInWithIdToken, useSession, type EndReason } from '@/auth/session';
import { BrandMark } from '@/components/Chrome';
import { useDocumentTitle } from '@/components/PageHeader';
import { accentRail, surfaces } from '@/theme';

const REASONS: Record<EndReason, { color: string; text: string }> = {
  expired: { color: 'amber', text: 'Your session expired. Sign in again to carry on where you were.' },
  revoked: { color: 'amber', text: 'Your session was ended - by you elsewhere, or by a Super Admin. Sign in again.' },
  security: { color: 'signal', text: 'A security issue was detected with your session, so it was closed. Sign in again, and tell the platform team if you did not expect this.' },
  signedOut: { color: 'forest', text: 'You’re signed out.' },
};

function Point({ title, body }: { title: string; body: string }) {
  return (
    <Group gap={13} wrap="nowrap" align="flex-start">
      <Box mt={7} w={6} h={6} style={{ flexShrink: 0, borderRadius: 3, background: accentRail }} />
      <div>
        <Text fw={600} size="sm" lh={1.4}>
          {title}
        </Text>
        <Text size="sm" c={surfaces.textMuted} lh={1.5}>
          {body}
        </Text>
      </div>
    </Group>
  );
}

function loginError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'auth.unauthorized') return 'That sign-in was not accepted. Check the access key, or sign in with single sign-on again.';
    if (error.code === 'auth.forbidden') return 'This account is disabled or its email domain is not allowed for StyleMint admin.';
    if (error.code === 'validation.multiple_errors') return 'That access key is too short to be valid.';
    if (error.status >= 500) return 'Sign-in is not configured on the server, or it could not reach the identity provider. Tell the platform team.';
  }
  return messageOf(error);
}

export function LoginPage() {
  useDocumentTitle('Sign in');
  const { session, ended } = useSession();
  const [params] = useSearchParams();
  const location = useLocation();
  const sso = getConfig().sso;
  const returnTo = safeReturnTo(params.get('next') ?? (location.state as { from?: string } | null)?.from ?? '/');
  const [keyOpen, setKeyOpen] = useState(!sso);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState<'sso' | 'key' | null>(null);
  const [error, setError] = useState<string | null>(params.get('error'));

  if (session) return <Navigate to={returnTo} replace />;

  const reason = ended ? REASONS[ended] : (params.get('reason') as EndReason | null) ? REASONS[params.get('reason') as EndReason] : undefined;

  const goSso = async () => {
    if (!sso) return;
    setBusy('sso');
    setError(null);
    try {
      await startSignIn(sso, returnTo);
    } catch (caught) {
      setError(messageOf(caught));
      setBusy(null);
    }
  };

  const submitKey = async (event: FormEvent) => {
    event.preventDefault();
    if (!key.trim()) {
      setError('Enter the access key.');
      return;
    }
    setBusy('key');
    setError(null);
    try {
      await signInWithIdToken(key.trim(), 'key');
      setKey('');
      // <Navigate> above takes over on the next render.
    } catch (caught) {
      setError(loginError(caught));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }} component="main">
      <Box
        style={{
          display: 'grid',
          gap: 'clamp(32px, 6vw, 72px)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          alignItems: 'center',
          width: '100%',
          maxWidth: 1000,
          padding: 'clamp(16px, 5vw, 56px)',
        }}
      >
        <Stack gap="xl" visibleFrom="sm">
          <Group gap="md" wrap="nowrap">
            <BrandMark size={44} />
            <div>
              <Title order={1} lh={1.1} style={{ letterSpacing: '-0.02em' }}>
                StyleMint Admin
              </Title>
              <Text size="sm" c={surfaces.textMuted} mt={2}>
                Operations console for the StyleMint marketplace
              </Text>
            </div>
          </Group>
          <Stack gap="md">
            <Point title="One queue for every application" body="Vendors, creators, buyers applying for EMI and riders - documents side by side, decisions with reasons." />
            <Point title="The whole marketplace in one place" body="Orders, refunds, payouts, deliveries and catalogue moderation, across every vendor." />
            <Point title="Every change accounted for" body="Sensitive actions ask for your authenticator and every decision lands in the audit log." />
          </Stack>
        </Stack>

        <Stack gap="md" style={{ width: '100%', maxWidth: 420, justifySelf: 'center' }}>
          <Group gap="sm" hiddenFrom="sm">
            <BrandMark size={38} />
            <div>
              <Title order={2} lh={1.1}>
                StyleMint Admin
              </Title>
              <Text size="sm" c={surfaces.textMuted}>
                Operations console
              </Text>
            </div>
          </Group>

          <Card padding="xl" style={{ boxShadow: 'var(--sm-shadow-high)', backgroundImage: 'linear-gradient(160deg, rgba(69, 174, 134, 0.055), transparent 46%)' }}>
            <Stack gap="md">
              <div>
                <Title order={2} fz="h3">
                  Sign in
                </Title>
                <Text size="sm" c={surfaces.textMuted} mt={4}>
                  For StyleMint operators. Your access is decided by the roles a Super Admin has granted you.
                </Text>
              </div>

              {reason && !error && (
                <Alert color={reason.color} variant="light" icon={<IconInfoCircle size={16} />} role="status">
                  {reason.text}
                </Alert>
              )}
              {error && (
                <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
                  {error}
                </Alert>
              )}

              {sso ? (
                <Button size="md" fullWidth leftSection={<IconLogin2 size={18} />} loading={busy === 'sso'} disabled={busy === 'key'} onClick={() => void goSso()}>
                  Continue with {sso.providerName ?? 'single sign-on'}
                </Button>
              ) : (
                <Alert color="slate" variant="light" icon={<IconInfoCircle size={16} />} role="status">
                  Single sign-on is not configured for this console yet. Use the access key your platform team issued.
                </Alert>
              )}

              {sso && (
                <Divider
                  label={
                    <Anchor component="button" type="button" size="sm" onClick={() => setKeyOpen((o) => !o)} aria-expanded={keyOpen} aria-controls="key-form">
                      {keyOpen ? 'Hide access key sign-in' : 'Sign in with an access key instead'}
                    </Anchor>
                  }
                  labelPosition="center"
                />
              )}

              <Collapse in={keyOpen} id="key-form">
                <form onSubmit={submitKey} noValidate>
                  <Stack gap="sm">
                    <PasswordInput
                      label="Access key"
                      description="Issued by the platform team for environments without single sign-on. It is never stored by this console."
                      autoComplete="off"
                      size="md"
                      value={key}
                      onChange={(e) => setKey(e.currentTarget.value)}
                      leftSection={<IconKey size={16} />}
                    />
                    <Button type="submit" variant={sso ? 'default' : 'filled'} size="md" fullWidth loading={busy === 'key'} disabled={busy === 'sso'}>
                      Sign in
                    </Button>
                  </Stack>
                </form>
              </Collapse>
            </Stack>
          </Card>

          <Text size="xs" c="dimmed" ta="center">
            Need access or a role? Ask a Super Admin. · StyleMint by Voyager IT Nepal
          </Text>
        </Stack>
      </Box>
    </Box>
  );
}
