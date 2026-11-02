import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi, normalizePhone, otpError, type AuthResponse } from '../auth/api';
import { chromeIntentUrl, detectBrowser, IN_APP_LABEL, withRestoreToken, type BrowserContext } from '../auth/inApp';
import { establish, useSession, type SignInMethod } from '../auth/session';
import { fetchSocialConfig, socialError, socialSignIn, type SocialWebConfig } from '../auth/social';
import { loadFacebookSdk, loadGoogleIdentity, makeNonce } from '../auth/thirdParty';
import { Loading } from '../components/ui';
import { nav } from '../lib/nav';
import { CART_KEY } from '../shop/cart';
import { replayGuestCart } from '../shop/guestCart';
import { createHandoff } from '../shop/handoff';

/** Only same-app paths: `/checkout`, never `//evil.example` or a full URL. */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/cart';
  return raw;
}

export default function SignInPage({ browser = detectBrowser() }: { browser?: BrowserContext }) {
  const s = useSession();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phoneFirst, setPhoneFirst] = useState(false);
  const finishing = useRef(false);
  const config = useQuery({ queryKey: ['social-config'], queryFn: fetchSocialConfig, staleTime: Infinity });

  async function finish(res: AuthResponse, method: SignInMethod) {
    finishing.current = true;
    establish(res, method);
    setBusy('Adding your cart…');
    const replay = await replayGuestCart();
    await qc.invalidateQueries({ queryKey: CART_KEY });
    navigate(replay.failed.length ? '/cart' : next, { replace: true });
  }

  if (s.status === 'loading') return <Loading />;
  if (s.status === 'signedIn' && !finishing.current) return <Navigate to={next} replace />;
  if (busy) return <Loading label={busy} />;

  const social: SocialWebConfig = config.data ?? { google: null, facebook: null };
  const showGoogle = browser.googleWorks && !!social.google;
  const showFacebook = browser.facebookWorks && !!social.facebook;

  return (
    <main className="page">
      <h1>Sign in to check out</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Use the same Google, Facebook or phone number later in the StyleMint app to track your order.
      </p>

      {browser.inApp && <InAppBanner browser={browser} googleOffered={!!social.google} />}

      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}

      {!phoneFirst && (showGoogle || showFacebook) && (
        <div style={{ display: 'grid', gap: 10, margin: '16px 0' }}>
          {showGoogle && social.google && (
            <GoogleButton
              clientId={social.google.clientId}
              onToken={async (token, nonce) => {
                setError(null);
                try {
                  await finish(await socialSignIn('google', token, nonce), 'google');
                } catch (e) {
                  const r = socialError(e, 'google');
                  setBusy(null);
                  setError(r.message);
                  setPhoneFirst(r.usePhone);
                }
              }}
              onError={setError}
            />
          )}
          {showFacebook && social.facebook && (
            <button
              type="button"
              className="btn btn-fb btn-block"
              onClick={async () => {
                setError(null);
                try {
                  const fb = await loadFacebookSdk(social.facebook!.appId, social.facebook!.graphVersion ?? undefined);
                  const token = await new Promise<string | null>((resolve) =>
                    fb.login((r) => resolve(r.status === 'connected' ? (r.authResponse?.accessToken ?? null) : null), { scope: 'public_profile,email' }),
                  );
                  if (!token) return;
                  await finish(await socialSignIn('facebook', token), 'facebook');
                } catch (e) {
                  const r = socialError(e, 'facebook');
                  setBusy(null);
                  setError(r.message);
                  setPhoneFirst(r.usePhone);
                }
              }}
            >
              Continue with Facebook
            </button>
          )}
        </div>
      )}

      {(showGoogle || showFacebook) && !phoneFirst && <div className="divider">or</div>}

      <PhoneSignIn onSignedIn={(res) => finish(res, 'phone')} />
    </main>
  );
}

function InAppBanner({ browser, googleOffered }: { browser: BrowserContext; googleOffered: boolean }) {
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const app = browser.inApp ? IN_APP_LABEL[browser.inApp] : 'this app';
  return (
    <div className="banner" role="note" aria-label="Open in your browser">
      <strong>{googleOffered ? 'Open in your browser to sign in with Google' : 'For the smoothest checkout, open this page in your browser'}</strong>
      <div style={{ marginTop: 4 }}>
        You’re in {app}’s built-in browser. Your cart comes with you.
      </div>
      {browser.os === 'android' ? (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ marginTop: 10 }}
          disabled={opening}
          onClick={async () => {
            setOpening(true);
            const token = await createHandoff();
            nav.assign(chromeIntentUrl(window.location.href, token));
            setOpening(false);
          }}
        >
          Open in Chrome
        </button>
      ) : (
        <>
          <ol className="steps-ios">
            <li>
              Tap <strong>···</strong> (or the share icon) at the top or bottom of the screen
            </li>
            <li>
              Choose <strong>Open in browser</strong> (or “Open in Safari”)
            </li>
          </ol>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 6 }}
            onClick={async () => {
              const token = await createHandoff();
              const link = withRestoreToken(window.location.href, token);
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                window.prompt('Copy this link', link);
              }
            }}
          >
            {copied ? 'Link copied — paste it in Safari' : 'Copy link'}
          </button>
        </>
      )}
    </div>
  );
}

function GoogleButton({ clientId, onToken, onError }: { clientId: string; onToken: (token: string, nonce: string) => void; onError: (m: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [gis, nonce] = await Promise.all([loadGoogleIdentity(), makeNonce()]);
        if (cancelled || !ref.current) return;
        gis.initialize({
          client_id: clientId,
          nonce: nonce.hashed,
          ux_mode: 'popup',
          use_fedcm_for_button: true,
          callback: (r) => {
            if (r.credential) onToken(r.credential, nonce.raw);
          },
        });
        gis.renderButton(ref.current, { type: 'standard', theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'pill', width: Math.min(400, ref.current.clientWidth || 320) });
      } catch {
        if (!cancelled) onError('Google sign-in could not load. Use your phone number instead.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // The button is rendered once per client id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);
  return <div ref={ref} style={{ minHeight: 44, display: 'flex', justifyContent: 'center' }} aria-label="Continue with Google" />;
}

function PhoneSignIn({ onSignedIn }: { onSignedIn: (res: AuthResponse) => Promise<void> }) {
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setError(null);
    const e164 = normalizePhone(phone);
    if (!e164) {
      setError('Enter a valid mobile number, e.g. 98XXXXXXXX');
      return;
    }
    setBusy(true);
    try {
      await authApi.requestOtp(e164);
      setSentTo(e164);
    } catch (e) {
      setError(otpError(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!sentTo) return;
    setError(null);
    setBusy(true);
    try {
      const res = await authApi.verifyOtp(sentTo, code.trim());
      await onSignedIn(res);
    } catch (e) {
      setError(otpError(e));
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void (sentTo ? verify() : send());
      }}
    >
      {!sentTo ? (
        <label className="field">
          <span>Mobile number</span>
          <input
            className="input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="98XXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
      ) : (
        <label className="field">
          <span>Enter the code we sent to {sentTo}</span>
          <input
            className="input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            autoFocus
          />
        </label>
      )}
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-block" disabled={busy || (!!sentTo && code.length < 4)}>
        {sentTo ? 'Verify and continue' : 'Continue with phone number'}
      </button>
      {sentTo && (
        <button
          type="button"
          className="link-btn"
          style={{ marginTop: 10 }}
          onClick={() => {
            setSentTo(null);
            setCode('');
          }}
        >
          Use a different number
        </button>
      )}
    </form>
  );
}
