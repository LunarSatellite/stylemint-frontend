/**
 * Read a JWT's payload. Decode only — the signature is never checked.
 *
 * That is deliberate and worth stating, because the opposite assumption
 * is a security bug waiting to happen. The browser cannot verify this
 * token: it has no key, and shipping one would not help since anything
 * the browser can check, the browser's owner can forge. These claims
 * drive what the UI *offers* — which nav entries to draw, which buttons
 * to grey out. Every one of those actions is authorised again server
 * side. Nothing here may be the only thing standing between an operator
 * and an endpoint.
 */
export interface AdminClaims {
  /** Admin account id. */
  sub: string;
  /** Session id. Used to mark "this browser" in the session list. */
  jti: string;
  email?: string;
  name?: string;
  roles: string[];
  /** Seconds since epoch. */
  exp: number;
  iat?: number;
}

function decodeSegment(segment: string): unknown {
  // base64url -> base64, and back to the padding atob insists on.
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** `null` for anything that is not a readable JWT payload. */
export function parseClaims(token: string | null | undefined): AdminClaims | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) return null;

  let payload: unknown;
  try {
    payload = decodeSegment(parts[1]);
  } catch {
    return null;
  }
  if (typeof payload !== 'object' || payload === null) return null;

  const raw = payload as Record<string, unknown>;
  const exp = typeof raw.exp === 'number' ? raw.exp : Number.NaN;
  if (!Number.isFinite(exp)) return null;

  return {
    sub: typeof raw.sub === 'string' ? raw.sub : '',
    jti: typeof raw.jti === 'string' ? raw.jti : '',
    email: typeof raw.email === 'string' ? raw.email : undefined,
    name: typeof raw.name === 'string' ? raw.name : undefined,
    roles: normaliseRoles(raw.role ?? raw.roles),
    exp,
    iat: typeof raw.iat === 'number' ? raw.iat : undefined,
  };
}

/**
 * .NET emits a single role as a string and several as an array, from the
 * same claim type. Treating the string case as an array of characters is
 * the classic way this goes wrong.
 */
function normaliseRoles(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((r): r is string => typeof r === 'string');
  return [];
}

/** True when the token is gone within `withinSeconds`. */
export function isExpiring(claims: AdminClaims | null, withinSeconds = 60): boolean {
  if (!claims) return true;
  return claims.exp - Date.now() / 1000 < withinSeconds;
}
