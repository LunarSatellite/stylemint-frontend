export interface JwtClaims {
  sub: string
  role: string
  exp: number
}

export function parseClaims(token: string): JwtClaims | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as JwtClaims
  } catch {
    return null
  }
}
