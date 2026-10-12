import { useEffect, useRef, useState } from 'react';
import { Alert, Anchor, Button, Group, Modal, PinInput, Stack, Text } from '@mantine/core';
import { IconShieldLock } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { ApiError, messageOf } from '@/api/errors';
import { registerStepUpPrompt, StepUpCancelled, verifyTotp } from './stepUp';

/**
 * The one step-up prompt, mounted once in the shell. A write that needs a fresh second factor waits on it; a correct
 * code resolves the wait and the write is sent again, a cancel rejects it and nothing is changed.
 */
export function StepUpDialog() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notEnrolled, setNotEnrolled] = useState(false);
  const pending = useRef<{ resolve: () => void; reject: (e: unknown) => void } | null>(null);

  useEffect(() => {
    registerStepUpPrompt(
      () =>
        new Promise<void>((resolve, reject) => {
          pending.current?.reject(new StepUpCancelled());
          pending.current = { resolve, reject };
          setCode('');
          setError(null);
          setNotEnrolled(false);
          setOpen(true);
        }),
    );
    return () => registerStepUpPrompt(null);
  }, []);

  const cancel = () => {
    if (busy) return;
    setOpen(false);
    pending.current?.reject(new StepUpCancelled());
    pending.current = null;
  };

  const submit = async (value = code) => {
    if (value.length < 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyTotp(value);
      setOpen(false);
      pending.current?.resolve();
      pending.current = null;
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'admin.mfa.not_enrolled') setNotEnrolled(true);
      setError(messageOf(caught));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={open} onClose={cancel} title={<Text fw={650}>Confirm it’s you</Text>} size="sm" closeOnClickOutside={false}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Stack gap="md">
          <Group gap="sm" wrap="nowrap" align="flex-start">
            <IconShieldLock size={22} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
            <Text size="sm">This change needs a fresh check. Enter the 6-digit code from your authenticator app. You won’t be asked again for five minutes.</Text>
          </Group>
          <Group justify="center">
            <PinInput
              length={6}
              type="number"
              oneTimeCode
              autoFocus
              value={code}
              onChange={setCode}
              onComplete={(v) => void submit(v)}
              disabled={busy}
              aria-label="Authenticator code"
              error={!!error}
            />
          </Group>
          {error && (
            <Alert color="signal" variant="light" role="alert">
              {error}
              {notEnrolled && (
                <>
                  {' '}
                  <Anchor component={Link} to="/security" onClick={cancel} size="sm">
                    Set up two-step verification
                  </Anchor>
                </>
              )}
            </Alert>
          )}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={cancel} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={code.length < 6}>
              Confirm
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
