import { useState, type FormEvent } from 'react';
import { Alert, Anchor, Button, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { ApiError } from '../../api/client';
import { authApi } from '../../auth/api';
import { passwordMeetsPolicy } from '../../auth/passwordPolicy';
import { passwordCreated, signOut } from '../../auth/session';
import { useSession } from '../../auth/useSession';
import { toastSuccess } from '../../lib/notify';
import { surfaces } from '../../theme';
import { AuthLayout } from './AuthLayout';
import { PasswordRules } from './PasswordRules';

/**
 * Mandatory after a code sign-in on an account with no password yet. Uses the authenticated
 * `PUT /v1/accounts/{id}/password` — never the anonymous registration route.
 */
export function CreatePasswordPage() {
  const { accountId } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!passwordMeetsPolicy(password)) {
      setError('Your password does not meet all the rules yet.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    if (!accountId) return;
    setBusy(true);
    try {
      await authApi.createPassword(accountId, password);
      toastSuccess('Password created. Next time you can sign in with it.');
      passwordCreated();
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'state.duplicate' || err.status === 409)) {
        // A password already exists (set elsewhere in the meantime) — nothing left to do here.
        passwordCreated();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Could not save your password. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Create your password">
      <form onSubmit={submit} noValidate>
        <Stack gap="md">
          <div>
            <Title order={3}>Create your password</Title>
            <Text size="sm" c={surfaces.textMuted} mt={4}>
              You signed in with a code. Set a password now so you can sign in faster next time.
            </Text>
          </div>
          {error && (
            <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
              {error}
            </Alert>
          )}
          <PasswordInput
            label="New password"
            autoComplete="new-password"
            size="md"
            required
            value={password}
            onChange={(ev) => setPassword(ev.currentTarget.value)}
            aria-describedby="password-rules"
          />
          <div id="password-rules">
            <PasswordRules value={password} />
          </div>
          <PasswordInput
            label="Confirm password"
            autoComplete="new-password"
            size="md"
            required
            value={confirm}
            error={(touched || confirm.length >= password.length) && mismatch ? 'Passwords do not match' : undefined}
            onChange={(ev) => setConfirm(ev.currentTarget.value)}
          />
          <Button type="submit" loading={busy} fullWidth size="md">
            Save password and continue
          </Button>
          <Anchor component="button" type="button" size="sm" ta="center" c="dimmed" onClick={() => void signOut()}>
            Sign out
          </Anchor>
        </Stack>
      </form>
    </AuthLayout>
  );
}
