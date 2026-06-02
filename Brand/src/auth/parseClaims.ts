export interface JwtClaims {
  sub:   string
  email: string
  role:  'vendor' | 'admin'
  exp:   number
  iat:   number
}

export function parseClaims(token: string): JwtClaims {
  const payload = token.split('.')[1]
  if (!payload) throw new Error('Invalid JWT')
  return JSON.parse(atob(payload)) as JwtClaims
}
