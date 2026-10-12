/**
 * Gets a new id_token from the IdP without showing anything: a hidden iframe opens the authorize URL with
 * `prompt=none`, the callback page inside it posts what it received back to this window, and the code (or token) is
 * redeemed here. Browsers that block third-party cookies make the IdP answer `login_required`; then this resolves
 * null and the operator is asked to sign in again.
 */
import type { SsoConfig } from '@/config';
import { buildAuthorizeUrl, completeSignIn } from './oidc';

export const SILENT_MESSAGE = 'sm.admin.sso.silent';

export function silentRenew(config: SsoConfig, timeoutMs = 8000): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.title = 'Session renewal';
    iframe.style.display = 'none';

    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timer);
      iframe.remove();
      resolve(value);
    };

    const onMessage = (event: MessageEvent<{ type?: string; search?: string; hash?: string }>) => {
      if (event.origin !== window.location.origin || event.data?.type !== SILENT_MESSAGE) return;
      completeSignIn(config, { search: event.data.search ?? '', hash: event.data.hash ?? '' })
        .then((r) => finish(r.idToken))
        .catch(() => finish(null));
    };

    const timer = window.setTimeout(() => finish(null), timeoutMs);
    window.addEventListener('message', onMessage);
    buildAuthorizeUrl(config, window.location.pathname, { silent: true })
      .then((url) => {
        iframe.src = url;
        document.body.appendChild(iframe);
      })
      .catch(() => finish(null));
  });
}
