import { useState, type FormEvent, type ReactNode } from 'react';
import { Alert, Anchor, Box, Button, Card, Group, List, PasswordInput, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconCircleCheck, IconLock, IconX } from '@tabler/icons-react';
import { Link, useSearchParams } from 'react-router-dom';
import { passwordApi, passwordRules } from '@/api/adminAuth';
import { ApiError, messageOf } from '@/api/errors';
import { BrandMark } from '@/components/Chrome';
import { useDocumentTitle } from '@/components/PageHeader';
import { surfaces } from '@/theme';

function setPasswordError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'admin_auth.token_invalid')
      return 'This link has expired or has already been used. Ask for a new one with “Forgot password?” on the sign-in page, or ask a Super Admin to send a new invitation.';
    if (error.status === 429) return 'Too many attempts. Wait a minute and try again.';
    if (error.isMissingEndpoint) return 'Setting a password isn’t available on this server yet. Tell the platform team.';
  }
  return messageOf(error);
}

/**
 * `/admin/set-password?token=…` - where both the "reset your password" email and the admin invitation email land.
 * The token is single-use; the server checks it and the password policy again. No third-party script loads here.
 */
export function SetPasswordPage() {
  useDocumentTitle('Set your password');
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const rules = passwordRules(password, confirm);
  const valid = rules.every((r) => r.met);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await passwordApi.set(token, password);
      setPassword('');
      setConfirm('');
      setDone(true);
    } catch (caught) {
      setError(setPasswordError(caught));
    } finally {
      setBusy(false);
    }
  };

  let body: ReactNode;
  if (!token) {
    body = (
      <Stack gap="md">
        <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
          This link is incomplete. Open the link from your email again, or ask for a new one with “Forgot password?” on the sign-in page.
        </Alert>
        <Button component={Link} to="/login" variant="default" size="md" fullWidth>
          Go to sign in
        </Button>
      </Stack>
    );
  } else if (done) {
    body = (
      <Stack gap="md">
        <Alert color="forest" variant="light" icon={<IconCircleCheck size={16} />} role="status" title="Your password is set">
          Sign in with your email address and the new password. The link you used no longer works, and after a password reset any sessions you had open are signed out.
        </Alert>
        <Button component={Link} to="/login" replace size="md" fullWidth>
          Sign in
        </Button>
      </Stack>
    );
  } else {
    body = (
      <form onSubmit={(e) => void submit(e)} noValidate aria-label="Set your password">
        <Stack gap="sm">
          <Text size="sm" c={surfaces.textMuted}>
            Choose the password you’ll sign in to StyleMint Admin with. This works for a password reset and for a new admin invitation.
          </Text>
          <PasswordInput
            label="New password"
            autoComplete="new-password"
            maxLength={128}
            size="md"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            leftSection={<IconLock size={16} />}
            aria-describedby="password-rules"
            data-autofocus
          />
          <PasswordInput
            label="Confirm new password"
            autoComplete="new-password"
            maxLength={128}
            size="md"
            value={confirm}
            onChange={(e) => setConfirm(e.currentTarget.value)}
            leftSection={<IconLock size={16} />}
            error={touched && confirm !== password ? 'The two entries are different' : null}
          />
          <List id="password-rules" aria-label="Password rules" spacing={4} size="sm" center>
            {rules.map((r) => (
              <List.Item
                key={r.id}
                data-met={r.met}
                icon={
                  <ThemeIcon size={18} radius="xl" color={r.met ? 'forest' : touched ? 'signal' : 'gray'} variant="light">
                    {r.met ? <IconCheck size={12} aria-hidden /> : <IconX size={12} aria-hidden />}
                  </ThemeIcon>
                }
              >
                <Text span size="sm" c={r.met ? undefined : 'dimmed'}>
                  {r.label}
                </Text>
                <Box component="span" style={visuallyHidden}>
                  {r.met ? ' - done' : ' - not yet'}
                </Box>
              </List.Item>
            ))}
          </List>
          {touched && !valid && !error && (
            <Text size="sm" c="signal" role="alert">
              The password doesn’t meet every rule yet.
            </Text>
          )}
          {error && (
            <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
              {error}
            </Alert>
          )}
          <Button type="submit" size="md" fullWidth loading={busy}>
            Set password
          </Button>
          <Group justify="center">
            <Anchor component={Link} to="/login" size="sm">
              Back to sign in
            </Anchor>
          </Group>
        </Stack>
      </form>
    );
  }

  return (
    <Box component="main" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 'clamp(16px, 5vw, 56px)' }}>
      <Stack gap="md" style={{ width: '100%', maxWidth: 440 }}>
        <Group gap="sm" justify="center">
          <BrandMark size={38} />
          <Title order={2} lh={1.1}>
            StyleMint Admin
          </Title>
        </Group>
        <Card padding="xl" style={{ boxShadow: 'var(--sm-shadow-high)' }}>
          <Stack gap="md">
            <Title order={1} fz="h3">
              Set your password
            </Title>
            {body}
          </Stack>
        </Card>
      </Stack>
    </Box>
  );
}

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;
