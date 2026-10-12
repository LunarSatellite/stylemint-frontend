import { useEffect, useRef, useState } from 'react';
import { Box, Button, Text } from '@mantine/core';
import { IconBrandFacebook, IconBrandGoogle } from '@tabler/icons-react';
import { loadFacebookSdk, loadGoogleIdentity, type FacebookSdk } from '@/auth/thirdParty';

type LoadState = 'loading' | 'ready' | 'failed';

/** The latest value of a callback, for SDK callbacks registered once. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

/**
 * "Continue with Google": Google Identity Services' own button (the ID token flow needs it - a custom button cannot
 * open Google's chooser), rendered once the script has loaded. Google hands back an ID token, which the caller
 * exchanges with `POST /v1/admin/auth/google`.
 */
export function GoogleSignInButton({ clientId, onToken, busy, disabled }: { clientId: string; onToken: (idToken: string) => void; busy: boolean; disabled: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<LoadState>('loading');
  const latest = useLatest(onToken);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    loadGoogleIdentity()
      .then((google) => {
        const parent = host.current;
        if (cancelled || !parent) return;
        google.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) latest.current(response.credential);
          },
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
          itp_support: true,
          context: 'signin',
        });
        parent.replaceChildren();
        google.renderButton(parent, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          // Google's button is 200-400 px wide and does not stretch on its own.
          width: Math.max(200, Math.min(400, parent.clientWidth || 360)),
        });
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, latest]);

  return (
    <Box>
      {state !== 'ready' && (
        <Button
          variant="default"
          size="md"
          fullWidth
          leftSection={<IconBrandGoogle size={18} />}
          loading={state === 'loading'}
          disabled={state === 'failed'}
          aria-describedby={state === 'failed' ? 'google-failed' : undefined}
        >
          Continue with Google
        </Button>
      )}
      <Box
        ref={host}
        data-testid="google-button-host"
        aria-busy={busy || undefined}
        style={{
          display: state === 'ready' ? 'flex' : 'none',
          justifyContent: 'center',
          minHeight: 44,
          // Google's button is an iframe; it cannot be disabled, only made unreachable while another sign-in runs.
          pointerEvents: busy || disabled ? 'none' : undefined,
          opacity: busy || disabled ? 0.55 : undefined,
        }}
      />
      {state === 'failed' && (
        <Text id="google-failed" size="xs" c="dimmed" mt={4}>
          Google sign-in could not load. Check that the browser or network is not blocking accounts.google.com, then reload.
        </Text>
      )}
    </Box>
  );
}

/**
 * "Continue with Facebook": the Facebook JS SDK's login popup. The SDK is loaded as the page opens so the popup can
 * open straight from the click (a popup opened after an await is blocked). It hands back a user access token, which
 * the caller exchanges with `POST /v1/admin/auth/facebook`; the email permission is what matches it to an admin.
 */
export function FacebookSignInButton({
  appId,
  onToken,
  onDeclinedEmail,
  busy,
  disabled,
}: {
  appId: string;
  onToken: (accessToken: string) => void;
  onDeclinedEmail: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  const [sdk, setSdk] = useState<FacebookSdk | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [rerequest, setRerequest] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    loadFacebookSdk(appId)
      .then((fb) => {
        if (cancelled) return;
        setSdk(fb);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [appId]);

  const start = () => {
    if (!sdk) return;
    sdk.login(
      (response) => {
        const auth = response.authResponse;
        // Closed the popup or said no: nothing happened, nothing to report.
        if (response.status !== 'connected' || !auth?.accessToken) return;
        const scopes = auth.grantedScopes?.split(',').map((s) => s.trim());
        if (scopes && !scopes.includes('email')) {
          // Without the email Facebook cannot be matched to an admin; ask for it again next time.
          setRerequest(true);
          onDeclinedEmail();
          return;
        }
        onToken(auth.accessToken);
      },
      { scope: 'email', return_scopes: true, ...(rerequest ? { auth_type: 'rerequest' as const } : {}) },
    );
  };

  return (
    <Box>
      <Button
        variant="default"
        size="md"
        fullWidth
        leftSection={<IconBrandFacebook size={18} color="var(--mantine-color-blue-6)" />}
        loading={state === 'loading' || busy}
        disabled={state === 'failed' || disabled}
        onClick={start}
        aria-describedby={state === 'failed' ? 'facebook-failed' : undefined}
      >
        Continue with Facebook
      </Button>
      {state === 'failed' && (
        <Text id="facebook-failed" size="xs" c="dimmed" mt={4}>
          Facebook sign-in could not load. Check that the browser or network is not blocking connect.facebook.net, then reload.
        </Text>
      )}
    </Box>
  );
}
