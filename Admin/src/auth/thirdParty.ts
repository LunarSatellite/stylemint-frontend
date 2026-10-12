/**
 * Google Identity Services and the Facebook JS SDK, loaded only when the sign-in page needs them (never in the rest
 * of the console, never on the set-password page) and only for a provider the server reports as configured.
 *
 * The CSP in front of the console has to allow these origins - see "Deploy" in README.md.
 */

export const GOOGLE_SDK_SRC = 'https://accounts.google.com/gsi/client';
export const FACEBOOK_SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';
/** Graph API version the SDK is initialised with. */
export const FACEBOOK_API_VERSION = 'v23.0';

// ---------------------------------------------------------------- Google Identity Services (ID token flow)

export interface GoogleCredentialResponse {
  /** The ID token (a JWT) - what `/v1/admin/auth/google` verifies. */
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
  }): void;
  renderButton(parent: HTMLElement, options: GoogleButtonOptions): void;
  disableAutoSelect?(): void;
  cancel?(): void;
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
      // Facebook's snippet loads with CORS; Google's must not (it sends no CORS headers).
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

let facebookAppId: string | null = null;

export async function loadFacebookSdk(appId: string, timeoutMs = 15_000): Promise<FacebookSdk> {
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
  if (facebookAppId !== appId) {
    // No cookie and no status check: the console only wants an access token at the moment the operator asks.
    fb.init({ appId, version: FACEBOOK_API_VERSION, cookie: false, xfbml: false, status: false });
    facebookAppId = appId;
  }
  return fb;
}

/** For tests. */
export function resetThirdPartyForTests() {
  scripts.clear();
  facebookAppId = null;
  delete w().google;
  delete w().FB;
  delete w().fbAsyncInit;
}
