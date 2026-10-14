import { useState, type FormEvent } from 'react';
import { Alert, Anchor, Button, Checkbox, Divider, Group, PasswordInput, PinInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconAlertTriangle, IconArrowLeft, IconInfoCircle, IconMessage2Code } from '@tabler/icons-react';
import { ApiError } from '../../api/client';
import { authApi, type OtpRequested } from '../../auth/api';
import { parseIdentifier, type ParsedIdentifier } from '../../auth/identifier';
import { establish } from '../../auth/session';
import { useSession } from '../../auth/useSession';
import { surfaces } from '../../theme';
import { AuthLayout } from './AuthLayout';
import { SocialSignIn } from './SocialSignIn';

type Mode = 'password' | 'code-request' | 'code-verify';

const OTP_LENGTH = 5;

function loginError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.isOffline) return 'Could not reach StyleMint. Check your internet connection and try again.';
    const t = e.message.toLowerCase();
    if (t.includes('invalid credentials')) return 'That email or phone and password do not match. Check them, or sign in with a code.';
    if (t.includes('temporarily locked'))
      return 'Too many wrong attempts — this account is locked for 30 minutes. You can sign in with a code instead.';
    if (t.includes('not active')) return 'This account is not active. Please contact StyleMint support.';
    if (e.status === 429) return 'Too many attempts. Please wait a minute and try again.';
    return e.message;
  }
  return 'Sign-in failed. Please try again.';
}

function otpError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.isOffline) return 'Could not reach StyleMint. Check your internet connection and try again.';
    if (e.code === 'resource.not_found' || e.status === 404) return 'This code has expired. Send a new one.';
    if (e.code === 'system.rate_limited' || e.status === 429) return 'Too many wrong codes. Send a new code and try again.';
    if (e.message.toLowerCase().includes('identifier not found')) return 'We could not find an account for that email or phone.';
    return e.message;
  }
  return 'That did not work. Please try again.';
}

export function LoginPage() {
  const { endedReason } = useSession();
  const [mode, setMode] = useState<Mode>('password');
  const [identifier, setIdentifier] = useState('');
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [socialBusy, setSocialBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [otp, setOtp] = useState<{ parsed: Extract<ParsedIdentifier, { ok: true }>; sent: OtpRequested } | null>(null);

  const parse = () => {
    const parsed = parseIdentifier(identifier);
    if (!parsed.ok) {
      setIdentifierError(parsed.error);
      return null;
    }
    setIdentifierError(null);
    return parsed;
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const parsed = parse();
    if (!parsed) return;
    if (!password) {
      setError('Enter your password, or sign in with a code.');
      return;
    }
    setBusy(true);
    try {
      const res = await authApi.login(parsed.type, parsed.value, password);
      await establish(res, { remember, checkPassword: false, method: 'password' });
    } catch (err) {
      setError(loginError(err));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    setNotice(null);
    const parsed = parse();
    if (!parsed) return;
    setBusy(true);
    try {
      const sent = await authApi.requestOtp(parsed.type, parsed.value);
      setOtp({ parsed, sent });
      setCode('');
      setMode('code-verify');
      setNotice(`We sent a ${OTP_LENGTH}-digit code to ${parsed.display}.`);
    } catch (err) {
      setError(otpError(err));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (value = code) => {
    if (!otp) return;
    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(value)) {
      setError(`Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await authApi.verifyOtp(otp.parsed.type, otp.parsed.value, value);
      await establish(res, { remember, checkPassword: true, method: 'code' });
    } catch (err) {
      setError(otpError(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const errorAlert = error && (
    <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert" data-testid="login-error">
      {error}
    </Alert>
  );

  const identifierField = (
    <TextInput
      label="Email or phone number"
      placeholder="you@gmail.com or 98XXXXXXXX"
      description={mode === 'password' ? undefined : 'Nepali numbers: we add +977 for you.'}
      autoComplete="username"
      size="md"
      required
      value={identifier}
      error={identifierError}
      onChange={(ev) => setIdentifier(ev.currentTarget.value)}
    />
  );

  const rememberBox = (
    <Checkbox
      label="Keep me signed in on this device"
      checked={remember}
      onChange={(ev) => setRemember(ev.currentTarget.checked)}
    />
  );

  return (
    <AuthLayout title="Sign in">
      {mode === 'password' && (
        <form onSubmit={submitPassword} noValidate>
          <Stack gap="md">
            <div>
              <Title order={3}>Sign in to Creator Studio</Title>
              <Text size="sm" c={surfaces.textMuted} mt={4}>
                Use the email or phone number of your StyleMint account.
              </Text>
            </div>
            {endedReason && !error && !info && (
              <Alert color="gray" variant="light" icon={<IconInfoCircle size={16} />}>
                {endedReason}
              </Alert>
            )}
            {errorAlert}
            {info && !error && (
              <Alert color="gray" variant="light" icon={<IconInfoCircle size={16} />} data-testid="login-info">
                {info}
              </Alert>
            )}
            <SocialSignIn
              remember={remember}
              disabled={busy}
              onStart={() => {
                setError(null);
                setInfo(null);
              }}
              onError={setError}
              onInfo={setInfo}
              onBusyChange={setSocialBusy}
            />
            {identifierField}
            <PasswordInput
              label="Password"
              autoComplete="current-password"
              size="md"
              required
              value={password}
              onChange={(ev) => setPassword(ev.currentTarget.value)}
            />
            {rememberBox}
            <Button type="submit" loading={busy} disabled={socialBusy} fullWidth size="md">
              Sign in
            </Button>
          </Stack>
          <Divider my="lg" label="First time here, or forgot your password?" labelPosition="center" />
          <Button
            variant="default"
            fullWidth
            size="md"
            leftSection={<IconMessage2Code size={18} />}
            disabled={socialBusy}
            onClick={() => {
              setError(null);
              setInfo(null);
              setMode('code-request');
            }}
          >
            Sign in with a code
          </Button>
        </form>
      )}

      {mode === 'code-request' && (
        <form onSubmit={sendCode} noValidate>
          <Stack gap="md">
            <div>
              <Title order={3}>Sign in with a code</Title>
              <Text size="sm" c={surfaces.textMuted} mt={4}>
                We will send a one-time code to your email or phone. Use this the first time you sign in, or if you
                forgot your password — you can set a new password afterwards.
              </Text>
            </div>
            {errorAlert}
            {identifierField}
            {rememberBox}
            <Button type="submit" loading={busy} fullWidth size="md">
              Send code
            </Button>
            <Anchor
              component="button"
              type="button"
              size="sm"
              ta="center"
              onClick={() => {
                setError(null);
                setMode('password');
              }}
            >
              Sign in with password instead
            </Anchor>
          </Stack>
        </form>
      )}

      {mode === 'code-verify' && otp && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verifyCode();
          }}
          noValidate
        >
          <Stack gap="md">
            <div>
              <Title order={3}>Enter your code</Title>
              {notice && (
                <Text size="sm" c={surfaces.textMuted} mt={4}>
                  {notice} It is valid for 5 minutes.
                </Text>
              )}
            </div>
            {otp.sent.isNewAccount && (
              <Alert color="amber" variant="light" icon={<IconInfoCircle size={16} />}>
                We could not find a StyleMint account for {otp.parsed.display}. Check it is the email or phone you use in the
                StyleMint app.
              </Alert>
            )}
            {otp.sent.devPlaintextCode && (
              <Alert color="gray" variant="light">
                Development code: <b>{otp.sent.devPlaintextCode}</b>
              </Alert>
            )}
            {errorAlert}
            <Group justify="center">
              <PinInput
                length={OTP_LENGTH}
                type="number"
                oneTimeCode
                size="lg"
                value={code}
                onChange={setCode}
                onComplete={(v) => void verifyCode(v)}
                aria-label="One-time code"
                autoFocus
              />
            </Group>
            <Button type="submit" loading={busy} fullWidth size="md">
              Verify and sign in
            </Button>
            <Group justify="space-between">
              <Anchor
                component="button"
                type="button"
                size="sm"
                onClick={() => {
                  setError(null);
                  setMode('code-request');
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <IconArrowLeft size={14} /> Change email/phone
              </Anchor>
              <Anchor component="button" type="button" size="sm" disabled={busy} onClick={() => void sendCode()}>
                Send a new code
              </Anchor>
            </Group>
          </Stack>
        </form>
      )}
    </AuthLayout>
  );
}
