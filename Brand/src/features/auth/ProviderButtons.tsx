import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, Button, Text } from '@mantine/core';
import { IconBrandAppleFilled, IconBrandFacebookFilled, IconBrandGoogleFilled } from '@tabler/icons-react';
import {
  loadAppleId,
  loadFacebookSdk,
  loadGoogleIdentity,
  makeNonce,
  type AppleIdAuth,
  type AppleSignInError,
  type FacebookSdk,
  type GoogleAccountsId,
} from '../../auth/thirdParty';
import type { SocialToken } from '../../auth/social';

type LoadState = 'loading' | 'ready' | 'failed';

/** Why a provider popup ended without a token. */
export type ProviderProblem = 'cancelled' | 'declinedEmail' | 'failed';

/** The latest value of a callback, for SDK callbacks registered once. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

/** Height shared by all three buttons (Google's "large" button is 40-44 px). */
const BUTTON_HEIGHT = 44;

function LoadFailed({ id, host, name }: { id: string; host: string; name: string }) {
  return (
    <Text id={id} size="xs" c="dimmed" mt={4}>
      {name} sign-in could not load. Check that the browser or network is not blocking {host}, then reload.
    </Text>
  );
}

/**
 * "Continue with Google": Google Identity Services' own button (the ID token flow needs it — a custom button cannot
 * open Google's chooser), rendered once the script has loaded. Google hands back an ID token.
 */
export function GoogleSignInButton({ clientId, onToken, busy, disabled }: { clientId: string; onToken: (t: SocialToken) => void; busy: boolean; disabled: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<LoadState>('loading');
  const latest = useLatest(onToken);

  useEffect(() => {
    let cancelled = false;
    setState('loading');

    // Google puts the nonce it is given into the ID token; it gets the SHA-256 of a fresh random value, the server
    // gets the raw value. One nonce per attempt: after each credential the button is set up again with a new one.
    const setup = async (google: GoogleAccountsId) => {
      const nonce = await makeNonce();
      const parent = host.current;
      if (cancelled || !parent) return;
      google.initialize({
        client_id: clientId,
        callback: (response) => {
          if (!response.credential) return;
          latest.current({ token: response.credential, nonce: nonce.raw });
          void setup(google).catch(() => undefined);
        },
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true,
        context: 'signin',
        nonce: nonce.hashed,
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
        width: Math.max(200, Math.min(400, parent.clientWidth || 356)),
      });
      setState('ready');
    };

    loadGoogleIdentity()
      .then(setup)
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
          h={BUTTON_HEIGHT}
          fullWidth
          leftSection={<IconBrandGoogleFilled size={18} />}
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
          minHeight: BUTTON_HEIGHT,
          // Google's button is an iframe; it cannot be disabled, only made unreachable while another sign-in runs.
          pointerEvents: busy || disabled ? 'none' : undefined,
          opacity: busy || disabled ? 0.55 : undefined,
        }}
      />
      {state === 'failed' && <LoadFailed id="google-failed" host="accounts.google.com" name="Google" />}
    </Box>
  );
}

/** A provider-branded button (Apple's and Facebook's own colours, logo left, label centred). */
function BrandButton({
  label,
  icon,
  background,
  color,
  state,
  busy,
  disabled,
  onClick,
  describedBy,
}: {
  label: string;
  icon: ReactNode;
  background: string;
  color: string;
  state: LoadState;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  describedBy?: string;
}) {
  return (
    <Button
      fullWidth
      h={BUTTON_HEIGHT}
      radius={6}
      leftSection={icon}
      loading={state === 'loading' || busy}
      disabled={state === 'failed' || disabled}
      onClick={onClick}
      aria-describedby={describedBy}
      styles={{
        root: { background, color, border: 'none', fontWeight: 600, fontSize: 15, opacity: state === 'failed' || disabled ? 0.55 : 1 },
        section: { color },
      }}
    >
      {label}
    </Button>
  );
}

/**
 * "Continue with Apple": Sign in with Apple JS in popup mode. The SDK is loaded and initialised as the page opens so
 * the popup opens straight from the click (a popup opened after an await is blocked). Apple hands back an identity
 * token, and — on the very first authorization only — the person's name.
 */
export function AppleSignInButton({
  servicesId,
  redirectUri,
  onToken,
  onProblem,
  busy,
  disabled,
}: {
  servicesId: string;
  redirectUri: string;
  onToken: (t: SocialToken) => void;
  onProblem: (p: ProviderProblem) => void;
  busy: boolean;
  disabled: boolean;
}) {
  const [auth, setAuth] = useState<AppleIdAuth | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  // The nonce for the next attempt; prepared ahead because hashing is async and the popup must open synchronously.
  const nonce = useRef<{ raw: string; hashed: string } | null>(null);

  const prepare = useCallback(async (sdk: AppleIdAuth) => {
    const next = await makeNonce();
    nonce.current = next;
    sdk.init({ clientId: servicesId, scope: 'name email', redirectURI: redirectUri, nonce: next.hashed, usePopup: true });
  }, [servicesId, redirectUri]);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    loadAppleId()
      .then(async (sdk) => {
        await prepare(sdk);
        if (cancelled) return;
        setAuth(sdk);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [prepare]);

  const start = () => {
    if (!auth || !nonce.current) return;
    const used = nonce.current;
    auth
      .signIn()
      .then((response) => {
        const token = response.authorization?.id_token;
        if (!token) {
          onProblem('failed');
          return;
        }
        const name = [response.user?.name?.firstName, response.user?.name?.lastName].filter((p) => p && p.trim()).join(' ');
        onToken({ token, displayName: name || null, nonce: used.raw });
      })
      .catch((e: AppleSignInError | undefined) => {
        const code = e?.error ?? '';
        onProblem(code === 'popup_closed_by_user' || code === 'user_cancelled_authorize' || code === 'user_trigger_new_signin_flow' ? 'cancelled' : 'failed');
      })
      .finally(() => {
        // A nonce is good for one attempt only.
        void prepare(auth).catch(() => undefined);
      });
  };

  return (
    <Box>
      <BrandButton
        label="Continue with Apple"
        icon={<IconBrandAppleFilled size={18} />}
        background="#000000"
        color="#ffffff"
        state={state}
        busy={busy}
        disabled={disabled}
        onClick={start}
        describedBy={state === 'failed' ? 'apple-failed' : undefined}
      />
      {state === 'failed' && <LoadFailed id="apple-failed" host="appleid.cdn-apple.com" name="Apple" />}
    </Box>
  );
}

/**
 * "Continue with Facebook": the Facebook JS SDK's login popup, loaded as the page opens so the popup can open
 * straight from the click. It hands back a user access token; the email permission is what finds the seller's
 * account, so a refusal is reported and the permission is asked for again next time.
 */
export function FacebookSignInButton({
  appId,
  graphVersion,
  onToken,
  onProblem,
  busy,
  disabled,
}: {
  appId: string;
  graphVersion?: string | null;
  onToken: (t: SocialToken) => void;
  onProblem: (p: ProviderProblem) => void;
  busy: boolean;
  disabled: boolean;
}) {
  const [sdk, setSdk] = useState<FacebookSdk | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [rerequest, setRerequest] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    loadFacebookSdk(appId, graphVersion ?? undefined)
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
  }, [appId, graphVersion]);

  const start = () => {
    if (!sdk) return;
    sdk.login(
      (response) => {
        const auth = response.authResponse;
        if (response.status !== 'connected' || !auth?.accessToken) {
          onProblem('cancelled');
          return;
        }
        const scopes = auth.grantedScopes?.split(',').map((s) => s.trim());
        if (scopes && !scopes.includes('email')) {
          setRerequest(true);
          onProblem('declinedEmail');
          return;
        }
        onToken({ token: auth.accessToken });
      },
      { scope: 'email', return_scopes: true, ...(rerequest ? { auth_type: 'rerequest' as const } : {}) },
    );
  };

  return (
    <Box>
      <BrandButton
        label="Continue with Facebook"
        icon={<IconBrandFacebookFilled size={20} />}
        background="#1877F2"
        color="#ffffff"
        state={state}
        busy={busy}
        disabled={disabled}
        onClick={start}
        describedBy={state === 'failed' ? 'facebook-failed' : undefined}
      />
      {state === 'failed' && <LoadFailed id="facebook-failed" host="connect.facebook.net" name="Facebook" />}
    </Box>
  );
}
