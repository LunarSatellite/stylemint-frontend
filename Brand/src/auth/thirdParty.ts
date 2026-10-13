/**
 * Google Identity Services, Sign in with Apple JS and the Facebook JS SDK — loaded only by the sign-in page (never
 * in the rest of Seller Center) and only for a provider the server reports as web-ready
 * (`GET /v1/auth/oauth/web-config`).
 *
 * Same approach as the Admin app's `src/auth/thirdParty.ts` (copied, not imported: the apps build separately).
 * The CSP in front of `/seller/` has to allow these origins — see "Deploy" in README.md.
 */

export const GOOGLE_SDK_SRC = 'https://accounts.google.com/gsi/client';
export const APPLE_SDK_SRC = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
export const FACEBOOK_SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';
/** Graph API version the Facebook SDK is initialised with, unless web-config names one. */
export const FACEBOOK_API_VERSION = 'v23.0';

// ---------------------------------------------------------------- Google Identity Services (ID token flow)

export interface GoogleCredentialResponse {
  /** The ID token (a JWT) — what `POST /v1/auth/oauth/google/native` verifies. */
  credential?: string;
  select_by?: string;
}

export interface GoogleButtonOptions {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number;
  locale?: string;
}

export interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    itp_support?: boolean;
    use_fedcm_for_button?: boolean;
    context?: 'signin' | 'signup' | 'use';
    nonce?: string;
  }): void;
  renderButton(parent: HTMLElement, options: GoogleButtonOptions): void;
  disableAutoSelect?(): void;
  cancel?(): void;
}

// ---------------------------------------------------------------- Sign in with Apple JS (popup mode)

export interface AppleInitConfig {
  /** The Apple Services ID (web), not the app's bundle id. */
  clientId: string;
  scope: string;
  /** Must be registered for the Services ID; in popup mode Apple posts the result back to this page instead. */
  redirectURI: string;
  state?: string;
  /** Apple copies this into the identity token's `nonce` claim. */
  nonce?: string;
  usePopup?: boolean;
}

export interface AppleSignInResponse {
  authorization: { id_token?: string; code?: string; state?: string };
  /** Only on the person's very first authorization of this Services ID. */
  user?: { email?: string; name?: { firstName?: string; lastName?: string } };
}

/** What `AppleID.auth.signIn()` rejects with, e.g. `{ error: 'popup_closed_by_user' }`. */
export interface AppleSignInError {
  error?: string;
}

export interface AppleIdAuth {
  init(config: AppleInitConfig): void;
  signIn(config?: Partial<AppleInitConfig>): Promise<AppleSignInResponse>;
}

// ---------------------------------------------------------------- Facebook JS SDK

export interface FacebookLoginResponse {
  status: 'connected' | 'not_authorized' | 'unknown' | string;
  authResponse?: {
    accessToken: string;
    userID?: string;
    expiresIn?: number;
    /** Comma-separated, when `return_scopes: true`. */
    grantedScopes?: string;
  } | null;
}

export interface FacebookSdk {
  init(params: { appId: string; version: string; cookie?: boolean; xfbml?: boolean; status?: boolean }): void;
  login(callback: (response: FacebookLoginResponse) => void, options?: { scope?: string; return_scopes?: boolean; auth_type?: 'rerequest' | 'reauthenticate' }): void;
}

interface ThirdPartyWindow {
  google?: { accounts?: { id?: GoogleAccountsId } };
  AppleID?: { auth?: AppleIdAuth };
  FB?: FacebookSdk;
  fbAsyncInit?: () => void;
}

const w = () => window as unknown as ThirdPartyWindow;

const scripts = new Map<string, Promise<void>>();

/** Adds a script tag once; a failed load can be retried. */
export function loadScript(src: string, opts: { crossOrigin?: boolean } = {}): Promise<void> {
  let pending = scripts.get(src);
  if (!pending) {
    pending = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      // Facebook's snippet loads with CORS; Google's and Apple's must not (they send no CORS headers).
      if (opts.crossOrigin) script.crossOrigin = 'anonymous';
      script.onload = () => resolve();
      script.onerror = () => {
        scripts.delete(src);
        script.remove();
        reject(new Error(`Could not load ${new URL(src).host}.`));
      };
      document.head.appendChild(script);
    });
    scripts.set(src, pending);
  }
  return pending;
}

export async function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  const ready = w().google?.accounts?.id;
  if (ready) return ready;
  await loadScript(GOOGLE_SDK_SRC);
  const id = w().google?.accounts?.id;
  if (!id) throw new Error('Google sign-in did not start.');
  return id;
}

export async function loadAppleId(): Promise<AppleIdAuth> {
  const ready = w().AppleID?.auth;
  if (ready) return ready;
  await loadScript(APPLE_SDK_SRC);
  const auth = w().AppleID?.auth;
  if (!auth) throw new Error('Apple sign-in did not start.');
  return auth;
}

let facebookInit: string | null = null;

export async function loadFacebookSdk(appId: string, version = FACEBOOK_API_VERSION, timeoutMs = 15_000): Promise<FacebookSdk> {
  if (!w().FB) {
    // The SDK calls window.fbAsyncInit once it has set itself up, which can be after the script's load event.
    let timer = 0;
    const initialised = new Promise<void>((resolve, reject) => {
      timer = window.setTimeout(() => reject(new Error('Facebook sign-in did not start.')), timeoutMs);
      const previous = w().fbAsyncInit;
      w().fbAsyncInit = () => {
        previous?.();
        resolve();
      };
    });
    // Only awaited when the script's load event comes first; never an unhandled rejection otherwise.
    initialised.catch(() => undefined);
    try {
      await loadScript(FACEBOOK_SDK_SRC, { crossOrigin: true });
      if (!w().FB) await initialised;
    } finally {
      window.clearTimeout(timer);
    }
  }
  const fb = w().FB;
  if (!fb) throw new Error('Facebook sign-in did not start.');
  if (facebookInit !== `${appId}@${version}`) {
    // No cookie and no status check: Seller Center only wants an access token at the moment the seller asks.
    fb.init({ appId, version, cookie: false, xfbml: false, status: false });
    facebookInit = `${appId}@${version}`;
  }
  return fb;
}

// ---------------------------------------------------------------- nonce

/** A fresh random nonce and its SHA-256 (hex). The provider gets the hash; the server gets the raw value. */
export async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashed };
}

/** For tests. */
export function resetThirdPartyForTests() {
  scripts.clear();
  facebookInit = null;
  delete w().google;
  delete w().AppleID;
  delete w().FB;
  delete w().fbAsyncInit;
}
