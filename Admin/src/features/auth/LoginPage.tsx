import { useSearchParams } from 'react-router-dom';

/**
 * The SSO entry point.
 *
 * `reason` is read from the URL because the interceptor puts it there
 * when it signs someone out, and the three cases are not the same
 * event: an expired token is routine, a revoked session means somebody
 * ended it, and a replayed token is a security finding. Telling them
 * apart is the difference between "log in again" and "tell someone".
 */
const REASONS: Record<string, string> = {
  expired: 'Your session expired. Please sign in again.',
  revoked: 'Your session was ended. Please sign in again.',
  security: 'A security issue was detected with your session. Please sign in again.',
};

export function LoginPage() {
  const [params] = useSearchParams();
  const reason = params.get('reason');
  const message = reason ? REASONS[reason] : undefined;

  return (
    <main className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-surface-border bg-bg-card p-8 shadow-soft">
        <h1 className="text-lg font-extrabold tracking-tight text-text-primary">
          Style Mint <span className="text-primary">Admin</span>
        </h1>
        <p className="mt-1 text-xs text-text-muted">Operator access. Single sign-on required.</p>

        {message && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-surface-border bg-surface-2 px-3 py-2 text-xs text-text-secondary"
          >
            {message}
          </p>
        )}

        <button
          type="button"
          disabled
          className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-bg-primary disabled:opacity-40"
        >
          Continue with single sign-on
        </button>
        <p className="mt-3 text-[11px] leading-4 text-text-muted">
          Disabled until the identity provider is configured — it needs
          <code className="px-1">VITE_SSO_AUTHORITY</code> and a registered redirect URI.
        </p>
      </div>
    </main>
  );
}
