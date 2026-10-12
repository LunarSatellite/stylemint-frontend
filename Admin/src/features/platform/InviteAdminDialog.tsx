import { useState, type FormEvent } from 'react';
import { ActionIcon, Alert, Button, Checkbox, CopyButton, Group, Modal, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconCheck, IconCopy, IconMail, IconShieldLock } from '@tabler/icons-react';
import { looksLikeEmail } from '@/api/adminAuth';
import { adminsApi, ROLE_NUMBER } from '@/api/admins';
import { ApiError, messageOf } from '@/api/errors';
import { ADMIN_ROLES, ROLE_DESCRIPTIONS, roleLabel } from '@/auth/roles';
import { withStepUp } from '@/auth/stepUp';
import { fmtDateTime } from '@/lib/format';

function inviteError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'mfa.step_up_cancelled') return 'Cancelled - no invitation was sent.';
    if (error.isMissingEndpoint) return 'Inviting admins isn’t available on this server yet.';
    const ref = error.correlationId ? ` (reference ${error.correlationId})` : '';
    return `${error.message}${ref}`;
  }
  return messageOf(error);
}

/** The invitation link the server returns only when its email could not be delivered. Kept in memory until closed. */
interface ManualLink {
  email: string;
  url: string;
  expiresUtc: string | null;
}

/**
 * Invite an admin by email: `POST /v1/admin/admins/invite` creates (or re-enables) the account with the chosen roles
 * and emails a link to set a password (valid 72 hours). They can then sign in with that password, or with Google or
 * Facebook on the same email address. Super Admin only, and it asks for the authenticator (step-up) like every other
 * change on this page. When the server could not send the email it returns the link once; it is shown here with a
 * copy button and forgotten when the dialog closes.
 */
export function InviteAdminDialog({ opened, onClose, onInvited }: { opened: boolean; onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState<ManualLink | null>(null);

  const reset = () => {
    setEmail('');
    setDisplayName('');
    setRoles([]);
    setTouched(false);
    setError(null);
    setManual(null);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const emailError = !looksLikeEmail(email) ? (email.trim() ? 'Enter a valid email address' : 'Email is required') : null;
  const nameError = displayName.trim().length < 2 ? 'Enter their name as colleagues know it' : null;
  const rolesError = roles.length === 0 ? 'Choose at least one role' : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (emailError || nameError || rolesError || busy) return;
    setBusy(true);
    setError(null);
    const sentTo = email.trim();
    try {
      const result = await withStepUp(() =>
        adminsApi.invite({
          email: sentTo,
          displayName: displayName.trim(),
          roles: roles.map((r) => ROLE_NUMBER[r]).filter((n): n is number => typeof n === 'number'),
        }),
      );
      onInvited();
      if (result?.invitationUrl) {
        setManual({ email: result.email || sentTo, url: result.invitationUrl, expiresUtc: result.invitationExpiresUtc ?? null });
        return;
      }
      notifications.show({ color: 'forest', title: 'Invitation sent', message: `${sentTo} will get an email with a link to set their password. It works for 72 hours.` });
      reset();
      onClose();
    } catch (caught) {
      setError(inviteError(caught));
    } finally {
      setBusy(false);
    }
  };

  if (manual) {
    return (
      <Modal opened={opened} onClose={close} title={<Text fw={650}>Admin added - send the link yourself</Text>} size="lg">
        <Stack gap="md">
          <Alert color="amber" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
            The invitation email to {manual.email} could not be delivered. Copy this link and send it to them yourself, privately. It works once
            {manual.expiresUtc ? `, until ${fmtDateTime(manual.expiresUtc)}` : ', for 72 hours'}, and it won’t be shown again.
          </Alert>
          <Group gap="xs" wrap="nowrap" align="flex-end">
            <TextInput label="Invitation link" value={manual.url} readOnly style={{ flex: 1 }} onFocus={(e) => e.currentTarget.select()} />
            <CopyButton value={manual.url}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copied' : 'Copy link'}>
                  <ActionIcon variant="default" size="lg" mb={2} onClick={copy} aria-label={copied ? 'Copied' : 'Copy link'}>
                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
          <Group justify="flex-end">
            <Button onClick={close}>Done</Button>
          </Group>
        </Stack>
      </Modal>
    );
  }

  return (
    <Modal opened={opened} onClose={close} title={<Text fw={650}>Invite an admin</Text>} size="lg" closeOnClickOutside={!busy}>
      <form onSubmit={(e) => void submit(e)} noValidate aria-label="Invite an admin">
        <Stack gap="md">
          <Text size="sm">
            They’ll get an email with a link to set their password (valid for 72 hours). After that they can sign in with that password, or with Google or Facebook on the same
            email address.
          </Text>
          <TextInput
            label="Email"
            type="email"
            required
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            leftSection={<IconMail size={16} />}
            error={touched ? emailError : null}
            data-autofocus
          />
          <TextInput label="Display name" required autoComplete="off" value={displayName} onChange={(e) => setDisplayName(e.currentTarget.value)} error={touched ? nameError : null} />
          <Checkbox.Group label="Roles" withAsterisk value={roles} onChange={setRoles} error={touched ? rolesError : null}>
            <Stack gap="xs" mt="xs">
              {ADMIN_ROLES.map((r) => (
                <Checkbox key={r} value={r} label={roleLabel(r)} description={ROLE_DESCRIPTIONS[r]} />
              ))}
            </Stack>
          </Checkbox.Group>
          <Group gap="xs" wrap="nowrap" c="dimmed">
            <IconShieldLock size={16} aria-hidden style={{ flexShrink: 0 }} />
            <Text size="sm">Sending the invitation asks for your authenticator code.</Text>
          </Group>
          {error && (
            <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
              {error}
            </Alert>
          )}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Send invitation
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
