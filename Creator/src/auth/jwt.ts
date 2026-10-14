/** StyleMint access-token claims (StyleMint.Shared.Infrastructure/Core/Identity/JwtIssuer.cs). */
export interface AccessClaims {
  sub: string;
  session_id?: string;
  /** Active role profiles, e.g. ["Customer","Creator"]. Always an array when present. */
  roles?: string[] | string;
  email_verified?: boolean | string;
  phone_verified?: boolean | string;
  exp?: number;
  iat?: number;
}

function base64UrlDecode(part: string): string {
  const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Reads the payload. Signature is the server's business — this is only for UI decisions. */
export function decodeJwt(token: string): AccessClaims | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    return JSON.parse(base64UrlDecode(payload)) as AccessClaims;
  } catch {
    return null;
  }
}

export function rolesOf(claims: AccessClaims | null): string[] {
  if (!claims?.roles) return [];
  return Array.isArray(claims.roles) ? claims.roles : [claims.roles];
}

export const CREATOR_ROLE = 'Creator';

export function isCreator(claims: AccessClaims | null): boolean {
  return rolesOf(claims).some((r) => r.toLowerCase() === CREATOR_ROLE.toLowerCase());
}
