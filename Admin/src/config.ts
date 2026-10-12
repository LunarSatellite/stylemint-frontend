/**
 * Runtime configuration. The console is a static bundle, so the identity provider is read at startup from
 * `/admin/config.json` (written by whoever deploys, no rebuild needed), falling back to build-time `VITE_*`
 * variables. Nothing here is secret: an OIDC client id and authority are public by design.
 */
import { z } from 'zod';

const ssoSchema = z.object({
  /** OIDC issuer, e.g. https://login.microsoftonline.com/<tenant>/v2.0 */
  authority: z.string().url(),
  clientId: z.string().min(1),
  /** `code` (PKCE, preferred) or `id_token` (implicit; only if the IdP has no CORS on its token endpoint). */
  responseType: z.enum(['code', 'id_token']).default('code'),
  scope: z.string().default('openid profile email'),
  /** Shown on the button: "Continue with Microsoft". */
  providerName: z.string().optional(),
  /** Extra authorize parameters some IdPs need (e.g. `{ "domain_hint": "voyageritnepal.com" }`). */
  extraParams: z.record(z.string()).optional(),
});

const configSchema = z.object({
  sso: ssoSchema.optional(),
  /**
   * Offer the environment's access key (`Admin:Oidc:DevSharedSecret`) under "Other ways to sign in". Off by default:
   * approved admins sign in with Google, Facebook or their email + password. Used only when `/methods` does not say
   * whether the server has an access key configured. (When the server is older than those
   * methods, the key is offered regardless - it is then the only way in.)
   */
  accessKey: z.boolean().optional(),
});

export type SsoConfig = z.infer<typeof ssoSchema>;
export type AppConfig = z.infer<typeof configSchema>;

let current: AppConfig = {};

function fromEnv(): AppConfig {
  const authority = import.meta.env.VITE_SSO_AUTHORITY as string | undefined;
  const clientId = import.meta.env.VITE_SSO_CLIENT_ID as string | undefined;
  const accessKey = (import.meta.env.VITE_ADMIN_ACCESS_KEY as string | undefined) === 'true' ? { accessKey: true } : {};
  if (!authority || !clientId) return accessKey;
  const parsed = ssoSchema.safeParse({
    authority,
    clientId,
    responseType: (import.meta.env.VITE_SSO_RESPONSE_TYPE as string | undefined) || undefined,
    providerName: (import.meta.env.VITE_SSO_PROVIDER_NAME as string | undefined) || undefined,
  });
  return parsed.success ? { ...accessKey, sso: parsed.data } : accessKey;
}

export async function loadConfig(fetchImpl: typeof fetch = fetch): Promise<AppConfig> {
  current = fromEnv();
  try {
    const response = await fetchImpl(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' });
    if (response.ok && (response.headers.get('Content-Type') ?? '').includes('json')) {
      const parsed = configSchema.safeParse(await response.json());
      // Each setting config.json names wins over its build-time value; the ones it leaves out stand.
      if (parsed.success) current = { ...current, ...parsed.data };
      else if (!parsed.success) console.warn('config.json is not valid; using build-time settings', parsed.error.flatten());
    }
  } catch {
    // No config.json: build-time settings stand.
  }
  return current;
}

export function getConfig(): AppConfig {
  return current;
}

export function setConfigForTests(next: AppConfig): void {
  current = next;
}
