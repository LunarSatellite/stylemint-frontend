import { useState, type FormEvent, type ReactNode } from 'react';
import { Alert, Anchor, Box, Button, Card, Collapse, Divider, Group, PasswordInput, Skeleton, Stack, Text, TextInput, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconAlertTriangle, IconArrowLeft, IconChevronDown, IconInfoCircle, IconKey, IconLock, IconLogin2, IconMail, IconMailCheck } from '@tabler/icons-react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { fetchAuthMethods, looksLikeEmail, passwordApi } from '@/api/adminAuth';
import { ApiError, messageOf } from '@/api/errors';
import { getConfig } from '@/config';
import { safeReturnTo, startSignIn } from '@/auth/oidc';
import { signInWithFacebook, signInWithGoogle, signInWithIdToken, signInWithPassword, useSession, type EndReason } from '@/auth/session';
import { BrandMark } from '@/components/Chrome';
import { useDocumentTitle } from '@/components/PageHeader';
import { accentRail, surfaces } from '@/theme';
import { FacebookSignInButton, GoogleSignInButton } from './ProviderButtons';

const REASONS: Record<EndReason, { color: string; text: string }> = {
  expired: { color: 'amber', text: 'Your session expired. Sign in again to carry on where you were.' },
  revoked: { color: 'amber', text: 'Your session was ended - by you elsewhere, or by a Super Admin. Sign in again.' },
  security: { color: 'signal', text: 'A security issue was detected with your session, so it was closed. Sign in again, and tell the platform team if you did not expect this.' },
  signedOut: { color: 'forest', text: 'You’re signed out.' },
};

export const RESET_SENT_MESSAGE = 'If that email belongs to an admin, we’ve sent a link to set a new password. It works once, within 30 minutes.';

type Method = 'google' | 'facebook' | 'password' | 'sso' | 'key';

const METHOD_NAME: Record<'google' | 'facebook' | 'password', string> = { google: 'Google', facebook: 'Facebook', password: 'Email and password' };

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

function minutesFrom(seconds: number | undefined): string {
  if (!seconds) return '';
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return ` Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

/** What went wrong with a Google, Facebook or password sign-in - never which part of it (nothing is enumerable). */
export function signInError(error: unknown, method: 'google' | 'facebook' | 'password'): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'admin_auth.invalid_credentials':
        if (method === 'password') return 'That email and password don’t match an admin account. Check them, or use “Forgot password?”.';
        if (method === 'google')
          return 'That Google account can’t sign in here. Use the Google account with your admin email address - its email must be verified with Google.';
        return 'That Facebook account can’t sign in here. It must use your admin email address, and once a Facebook account is linked to your admin account only that one works.';
      case 'admin_auth.locked':
        return `Too many failed sign-in attempts for this email, so sign-in is locked for 15 minutes.${minutesFrom(error.retryAfter)} You can reset your password meanwhile.`;
      case 'admin_auth.method_unavailable':
        return `${METHOD_NAME[method]} sign-in isn’t set up on the server right now. Use another way to sign in, or tell the platform team.`;
      case 'admin.rate_limited':
      case 'system.rate_limited':
        return `Too many sign-in attempts from here.${minutesFrom(error.retryAfter) || ' Wait a minute and try again.'}`;
    }
    if (error.isOffline) return error.message;
    if (error.status === 429) return `Too many sign-in attempts.${minutesFrom(error.retryAfter) || ' Wait a minute and try again.'}`;
    if (error.isMissingEndpoint) return `${METHOD_NAME[method]} sign-in isn’t available on this server yet.`;
    if (error.status >= 500) return 'Sign-in failed on the server. Try again in a moment, and tell the platform team if it keeps happening.';
  }
  return messageOf(error);
}

function legacyError(error: unknown): string {
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
  const config = getConfig();
  const returnTo = safeReturnTo(params.get('next') ?? (location.state as { from?: string } | null)?.from ?? '/');
  const methodsQuery = useQuery({ queryKey: ['admin-auth-methods'], queryFn: ({ signal }) => fetchAuthMethods(signal), staleTime: 5 * 60_000, gcTime: 5 * 60_000 });

  const [busy, setBusy] = useState<Method | null>(null);
  const [error, setError] = useState<string | null>(params.get('error'));
  const [mode, setMode] = useState<'signin' | 'forgot' | 'sent'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetTouched, setResetTouched] = useState(false);
  const [otherToggled, setOtherToggled] = useState<boolean | null>(null);
  const [keyToggled, setKeyToggled] = useState<boolean | null>(null);
  const [key, setKey] = useState('');

  if (session) return <Navigate to={returnTo} replace />;

  const reasonKey = ended ?? (params.get('reason') as EndReason | null);
  const reason = reasonKey ? REASONS[reasonKey] : undefined;

  // A failure to read the methods is not "no methods": the password form stays (the contract always has it).
  const methods = methodsQuery.data;
  const loadingMethods = methodsQuery.isLoading;
  const legacy = methods?.legacy ?? false;
  const google = methods?.google ?? null;
  const facebook = methods?.facebook ?? null;
  const passwordOn = methods ? methods.password : methodsQuery.isError;
  // Single sign-on needs the IdP settings here (config.json) and the server saying it trusts one; the access key
  // only the server's word. Where the server does not say, the console's own config decides.
  const sso = config.sso && methods?.sso !== false ? config.sso : undefined;
  const accessKeyOn = legacy || (methods?.accessKey ?? config.accessKey === true);
  const hasPrimary = !!google || !!facebook || passwordOn;
  const hasOther = !!sso || accessKeyOn;
  // With no primary method (an older server, or none configured) the other ways are the way in, shown open.
  const otherOpen = otherToggled ?? !hasPrimary;
  const keyOpen = keyToggled ?? !sso;

  const run = async (method: Method, work: () => Promise<unknown>, describe: (e: unknown) => string) => {
    setBusy(method);
    setError(null);
    try {
      await work();
      // <Navigate> above takes over on the next render.
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setBusy(null);
    }
  };

  const emailError = touched && !looksLikeEmail(email) ? (email.trim() ? 'Enter a valid email address' : 'Enter your email address') : null;
  const passwordError = touched && !password ? 'Enter your password' : null;

  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!looksLikeEmail(email) || !password) return;
    void run(
      'password',
      async () => {
        await signInWithPassword(email, password);
      },
      (e) => signInError(e, 'password'),
    ).finally(() => {
      // A refused password is not kept in the field (or in memory) for a second look.
      setPassword('');
      setTouched(false);
    });
  };

  const submitReset = async (event: FormEvent) => {
    event.preventDefault();
    setResetTouched(true);
    if (!looksLikeEmail(resetEmail)) return;
    setBusy('password');
    setError(null);
    try {
      await passwordApi.requestReset(resetEmail);
      setMode('sent');
    } catch (caught) {
      // The answer must not depend on the address. Only "it never reached the server" or "the server failed" are
      // worth saying - waiting for an email that was never sent helps nobody.
      if (caught instanceof ApiError && (caught.isOffline || caught.status >= 500)) setError(caught.isOffline ? caught.message : 'The link could not be sent right now. Try again in a moment.');
      else setMode('sent');
    } finally {
      setBusy(null);
    }
  };

  const submitKey = (event: FormEvent) => {
    event.preventDefault();
    if (!key.trim()) {
      setError('Enter the access key.');
      return;
    }
    void run(
      'key',
      async () => {
        await signInWithIdToken(key.trim(), 'key');
        setKey('');
      },
      legacyError,
    );
  };

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

  const openForgot = () => {
    setResetEmail(email);
    setResetTouched(false);
    setError(null);
    setMode('forgot');
  };

  const backToSignIn = () => {
    setError(null);
    setMode('signin');
  };

  const otherWays: ReactNode = hasOther && (
    <Stack gap="md">
      {sso && (
        <Button size="md" fullWidth variant={hasPrimary ? 'default' : 'filled'} leftSection={<IconLogin2 size={18} />} loading={busy === 'sso'} disabled={busy !== null && busy !== 'sso'} onClick={() => void goSso()}>
          Continue with {sso.providerName ?? 'single sign-on'}
        </Button>
      )}
      {accessKeyOn && (
        <>
          {sso && (
            <Divider
              label={
                <Anchor component="button" type="button" size="sm" onClick={() => setKeyToggled(!keyOpen)} aria-expanded={keyOpen} aria-controls="key-form">
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
                  description="Issued by the platform team for environments without another way in. It is never stored by this console."
                  autoComplete="off"
                  size="md"
                  value={key}
                  onChange={(e) => setKey(e.currentTarget.value)}
                  leftSection={<IconKey size={16} />}
                />
                <Button type="submit" variant={sso || hasPrimary ? 'default' : 'filled'} size="md" fullWidth loading={busy === 'key'} disabled={busy !== null && busy !== 'key'}>
                  Sign in with access key
                </Button>
              </Stack>
            </form>
          </Collapse>
        </>
      )}
    </Stack>
  );

  const signInBody = (
    <>
      {loadingMethods ? (
        <Stack gap="sm" aria-busy="true" aria-label="Loading sign-in options">
          <Skeleton height={42} radius="md" />
          <Skeleton height={42} radius="md" />
          <Skeleton height={42} radius="md" />
        </Stack>
      ) : (
        <>
          {methodsQuery.isError && (
            <Alert color="amber" variant="light" icon={<IconInfoCircle size={16} />} role="status">
              The sign-in options could not be loaded, so only email and password are shown.{' '}
              <Anchor component="button" type="button" size="sm" onClick={() => void methodsQuery.refetch()}>
                Try again
              </Anchor>
            </Alert>
          )}

          {(google || facebook) && (
            <Stack gap="sm">
              {google && (
                <GoogleSignInButton
                  clientId={google.clientId}
                  busy={busy === 'google'}
                  disabled={busy !== null}
                  onToken={(idToken) => void run('google', () => signInWithGoogle(idToken), (e) => signInError(e, 'google'))}
                />
              )}
              {facebook && (
                <FacebookSignInButton
                  appId={facebook.appId}
                  busy={busy === 'facebook'}
                  disabled={busy !== null && busy !== 'facebook'}
                  onDeclinedEmail={() => setError('StyleMint needs the email address on your Facebook account to match it to your admin account. Try again and allow access to your email.')}
                  onToken={(accessToken) => void run('facebook', () => signInWithFacebook(accessToken), (e) => signInError(e, 'facebook'))}
                />
              )}
            </Stack>
          )}

          {(google || facebook) && passwordOn && <Divider label="or" labelPosition="center" />}

          {passwordOn && (
            <form onSubmit={submitPassword} noValidate aria-label="Sign in with email and password">
              <Stack gap="sm">
                <TextInput
                  label="Email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  size="md"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  leftSection={<IconMail size={16} />}
                  error={emailError}
                />
                <div>
                  <PasswordInput
                    label="Password"
                    autoComplete="current-password"
                    size="md"
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value)}
                    leftSection={<IconLock size={16} />}
                    error={passwordError}
                  />
                  <Group justify="flex-end" mt={6}>
                    <Anchor component="button" type="button" size="sm" onClick={openForgot}>
                      Forgot password?
                    </Anchor>
                  </Group>
                </div>
                <Button type="submit" size="md" fullWidth loading={busy === 'password'} disabled={busy !== null && busy !== 'password'}>
                  Sign in
                </Button>
              </Stack>
            </form>
          )}

          {!hasPrimary && !hasOther && (
            <Alert color="slate" variant="light" icon={<IconInfoCircle size={16} />} role="status">
              No way of signing in is set up for this console yet. Tell the platform team.
            </Alert>
          )}

          {hasOther &&
            (hasPrimary ? (
              <Stack gap="sm">
                <Divider
                  label={
                    <Anchor component="button" type="button" size="sm" c="dimmed" onClick={() => setOtherToggled(!otherOpen)} aria-expanded={otherOpen} aria-controls="other-ways">
                      <Box component="span" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Other ways to sign in
                        <IconChevronDown size={14} style={{ transform: otherOpen ? 'rotate(180deg)' : undefined, transition: 'transform 150ms ease' }} aria-hidden />
                      </Box>
                    </Anchor>
                  }
                  labelPosition="center"
                />
                <Collapse in={otherOpen} id="other-ways">
                  {otherWays}
                </Collapse>
              </Stack>
            ) : (
              otherWays
            ))}
        </>
      )}
    </>
  );

  const forgotBody = (
    <form onSubmit={(e) => void submitReset(e)} noValidate aria-label="Reset your password">
      <Stack gap="sm">
        <Text size="sm">Enter the email address of your admin account. If it is one, we’ll email a link to set a new password.</Text>
        <TextInput
          label="Email"
          type="email"
          autoComplete="username"
          inputMode="email"
          size="md"
          value={resetEmail}
          onChange={(e) => setResetEmail(e.currentTarget.value)}
          leftSection={<IconMail size={16} />}
          error={resetTouched && !looksLikeEmail(resetEmail) ? 'Enter a valid email address' : null}
          data-autofocus
        />
        <Button type="submit" size="md" fullWidth loading={busy === 'password'}>
          Send reset link
        </Button>
        <Anchor component="button" type="button" size="sm" onClick={backToSignIn} style={{ alignSelf: 'center' }}>
          <Box component="span" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <IconArrowLeft size={14} aria-hidden /> Back to sign in
          </Box>
        </Anchor>
      </Stack>
    </form>
  );

  const sentBody = (
    <Stack gap="md">
      <Alert color="forest" variant="light" icon={<IconMailCheck size={16} />} role="status">
        {RESET_SENT_MESSAGE}
      </Alert>
      <Text size="sm" c={surfaces.textMuted}>
        Nothing arrived? Check spam, make sure it is the address your Super Admin invited, or ask them to send you an invitation.
      </Text>
      <Button variant="default" size="md" fullWidth onClick={backToSignIn}>
        Back to sign in
      </Button>
    </Stack>
  );

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
                  {mode === 'signin' ? 'Sign in' : 'Reset your password'}
                </Title>
                {mode === 'signin' && (
                  <Text size="sm" c={surfaces.textMuted} mt={4}>
                    For StyleMint admins only - use the email address your Super Admin approved. What you can do is decided by your roles.
                  </Text>
                )}
              </div>

              {reason && !error && mode === 'signin' && (
                <Alert color={reason.color} variant="light" icon={<IconInfoCircle size={16} />} role="status">
                  {reason.text}
                </Alert>
              )}
              {error && (
                <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
                  {error}
                </Alert>
              )}

              {mode === 'signin' ? signInBody : mode === 'forgot' ? forgotBody : sentBody}
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
