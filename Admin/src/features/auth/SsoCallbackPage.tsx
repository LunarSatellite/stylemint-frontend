import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Center, Loader, Stack, Text } from '@mantine/core';
import { Link, useNavigate } from 'react-router-dom';
import { messageOf } from '@/api/errors';
import { getConfig } from '@/config';
import { completeSignIn } from '@/auth/oidc';
import { signInWithIdToken } from '@/auth/session';
import { SILENT_MESSAGE } from '@/auth/silentRenew';

/**
 * Where the identity provider sends the operator back. Inside the hidden renewal iframe it only hands the answer to
 * the parent window; at the top level it redeems it and signs in.
 */
export function SsoCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);
  const inFrame = typeof window !== 'undefined' && window.parent !== window;

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (inFrame) {
      window.parent.postMessage({ type: SILENT_MESSAGE, search: window.location.search, hash: window.location.hash }, window.location.origin);
      return;
    }
    const sso = getConfig().sso;
    if (!sso) {
      setError('Single sign-on is not configured for this console.');
      return;
    }
    completeSignIn(sso, { search: window.location.search, hash: window.location.hash })
      .then(async ({ idToken, returnTo }) => {
        await signInWithIdToken(idToken, 'sso');
        navigate(returnTo, { replace: true });
      })
      .catch((caught) => setError(messageOf(caught)));
  }, [inFrame, navigate]);

  if (inFrame) return null;

  return (
    <Center mih="100vh" p="md">
      {error ? (
        <Stack maw={440} gap="md">
          <Alert color="signal" variant="light" title="Sign-in didn’t complete" role="alert">
            {error}
          </Alert>
          <Button component={Link} to="/login" replace>
            Back to sign-in
          </Button>
        </Stack>
      ) : (
        <Stack align="center" gap="xs" role="status">
          <Loader color="forest" size="sm" />
          <Text size="sm" c="dimmed">
            Signing you in…
          </Text>
        </Stack>
      )}
    </Center>
  );
}
