/**
 * Configuration, checked once at startup.
 *
 * It throws rather than defaulting. A missing SSO authority that falls
 * back to a placeholder produces a login screen that fails at the
 * redirect, several steps from the cause; a missing API base URL
 * produces requests to the admin's own origin, which 404 as HTML and
 * surface as JSON parse errors. Failing on the first line of the app
 * names the variable instead.
 */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL as string,
  ssoAuthority: import.meta.env.VITE_SSO_AUTHORITY as string,
  ssoClientId: import.meta.env.VITE_SSO_CLIENT_ID as string,
  ssoRedirectUri: import.meta.env.VITE_SSO_REDIRECT_URI as string,
} as const;

export function assertEnv(source: Record<string, unknown> = env): void {
  const missing = Object.entries(source)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) {
    throw new Error(`Missing env variable: ${missing.join(', ')}`);
  }
}
