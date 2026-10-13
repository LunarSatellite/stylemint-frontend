import { api } from '../../api/client';

/**
 * Connected social accounts (Social module SocialAccountsController / SocialConnectController).
 * Provider slugs: instagram | tiktok | youtube | facebook. `provider` in the DTO is an integer.
 *
 * Web connect: the backend finishes OAuth on its own callback and then redirects to the app deep link
 * (`stylemint://social-connected`), which a browser cannot open. So the page opens the provider in a popup
 * and polls `GET /v1/social/accounts/{slug}` until the account is Active (see `connectInPopup`).
 */
export type SocialSlug = 'instagram' | 'tiktok' | 'youtube' | 'facebook';
export const SOCIAL_SLUGS: SocialSlug[] = ['instagram', 'tiktok', 'youtube', 'facebook'];
export const slugLabel: Record<SocialSlug, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube Shorts', facebook: 'Facebook' };
export const providerToSlug: Record<number, SocialSlug> = { 1: 'instagram', 2: 'tiktok', 3: 'youtube', 4: 'facebook' };

export const SocialAccountState = { Connecting: 1, Active: 2, Expired: 3, Revoked: 4, RateLimited: 5 } as const;
export const socialStateLabel: Record<number, string> = { 1: 'Connecting', 2: 'Connected', 3: 'Expired — reconnect', 4: 'Revoked — reconnect', 5: 'Rate limited' };
export const socialStateColor: Record<number, string> = { 1: 'blue', 2: 'forest', 3: 'amber', 4: 'signal', 5: 'amber' };

export interface SocialAccount {
  id: string;
  provider: number;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  followerCount: number | null;
  state: number;
  lastErrorCode: string | null;
  lastSyncedUtc: string | null;
  rateLimitedUntilUtc: string | null;
  createdUtc: string;
}

export interface AudienceSummary {
  [key: string]: unknown;
}

export interface AuthorizeUrl {
  url: string;
  state: string;
  expiresUtc: string;
  provider: number;
}

export const socialApi = {
  list: () => api.get<SocialAccount[]>('/v1/social/accounts'),
  get: (slug: SocialSlug) => api.get<SocialAccount>(`/v1/social/accounts/${slug}`),
  begin: (slug: SocialSlug) => api.post<AuthorizeUrl>(`/v1/social/connect/${slug}/begin`, {}),
  disconnect: (slug: SocialSlug) => api.del<void>(`/v1/social/accounts/${slug}`, { body: {} }),
  refresh: (slug: SocialSlug) => api.post<void>(`/v1/social/accounts/${slug}/refresh`),
};

export const isConnected = (a: SocialAccount | undefined) => !!a && a.state === SocialAccountState.Active;

/**
 * Opens the provider's sign-in in a popup and waits until the backend reports the account Active. Only offered
 * for an account that is not Active yet (new, expired or revoked), so "Active" means this connect landed.
 * Resolves 'connected', 'closed' (the person closed the window first) or 'timeout'.
 */
export async function connectInPopup(
  slug: SocialSlug,
  opts: { pollMs?: number; open?: (url: string) => Window | null; signal?: AbortSignal } = {},
): Promise<'connected' | 'closed' | 'timeout' | 'blocked'> {
  // Open synchronously-ish: create the window first so popup blockers see the click, then navigate it.
  const opener = opts.open ?? ((url: string) => window.open(url, `sm-connect-${slug}`, 'popup,width=520,height=720'));
  const popup = opener('about:blank');
  if (!popup) return 'blocked';
  let auth: AuthorizeUrl;
  try {
    auth = await socialApi.begin(slug);
  } catch (e) {
    popup.close();
    throw e;
  }
  popup.location.href = auth.url;
  const deadline = Math.min(Date.parse(auth.expiresUtc) || Date.now() + 15 * 60_000, Date.now() + 15 * 60_000);
  const pollMs = opts.pollMs ?? 2500;
  while (Date.now() < deadline) {
    if (opts.signal?.aborted) {
      popup.close();
      return 'closed';
    }
    await new Promise((r) => setTimeout(r, pollMs));
    try {
      const account = await socialApi.get(slug);
      if (account.state === SocialAccountState.Active) {
        popup.close();
        return 'connected';
      }
    } catch {
      // 404 until the connect lands — keep waiting.
    }
    if (popup.closed) {
      // One last look: the person may have closed it right after finishing.
      try {
        const account = await socialApi.get(slug);
        if (account.state === SocialAccountState.Active) return 'connected';
      } catch {
        /* not connected */
      }
      return 'closed';
    }
  }
  popup.close();
  return 'timeout';
}
