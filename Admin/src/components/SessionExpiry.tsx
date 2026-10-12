import { useEffect, useRef, useState } from 'react';
import { Button, Group, Notification, Portal, Text } from '@mantine/core';
import { IconClockExclamation } from '@tabler/icons-react';
import { useLocation } from 'react-router-dom';
import { getConfig } from '@/config';
import { startSignIn } from '@/auth/oidc';
import { endSession, refreshSession, useSession } from '@/auth/session';

const WARN_MS = 5 * 60_000;

/**
 * Admin tokens are not refreshable, so the console says so before one runs out: five minutes ahead it offers to
 * renew (silently through the identity provider when it can, otherwise a quick round trip that returns to this page),
 * and at expiry it ends the session cleanly instead of letting the next click fail.
 */
export function SessionExpiryWatcher() {
  const { session } = useSession();
  const location = useLocation();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [dismissedFor, setDismissedFor] = useState<number | null>(null);
  const tried = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const expiresAt = session?.expiresAt ?? 0;
  const left = expiresAt - now;

  useEffect(() => {
    if (!session) return;
    if (left <= 0) endSession('expired');
  }, [left, session]);

  // One silent attempt per token as the warning window opens: most operators never see the banner.
  useEffect(() => {
    if (!session || session.via !== 'sso' || left > WARN_MS || left <= 0 || tried.current === expiresAt) return;
    tried.current = expiresAt;
    void refreshSession();
  }, [session, left, expiresAt]);

  if (!session || left > WARN_MS || left <= 0 || dismissedFor === expiresAt) return null;

  const minutes = Math.max(1, Math.round(left / 60_000));
  const sso = getConfig().sso;
  const here = `${location.pathname}${location.search}`;

  const renew = async () => {
    setBusy(true);
    if (session.via === 'sso' && sso) {
      const ok = await refreshSession();
      if (!ok) await startSignIn(sso, here);
    } else {
      endSession('expired');
    }
    setBusy(false);
  };

  return (
    <Portal>
      <Notification
        icon={<IconClockExclamation size={18} />}
        color="amber"
        title="Your session ends soon"
        onClose={() => setDismissedFor(expiresAt)}
        style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 400, maxWidth: 380, boxShadow: 'var(--sm-shadow-high)' }}
        role="status"
        withBorder
      >
        <Text size="sm">About {minutes} minute{minutes === 1 ? '' : 's'} left. Renew now so an action in progress isn’t interrupted.</Text>
        <Group mt="xs">
          <Button size="xs" onClick={() => void renew()} loading={busy}>
            {session.via === 'sso' ? 'Stay signed in' : 'Sign in again'}
          </Button>
        </Group>
      </Notification>
    </Portal>
  );
}
