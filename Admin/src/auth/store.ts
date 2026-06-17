import { create } from 'zustand'
import { parseClaims } from './parseClaims'
import { AdminRole } from '@/lib/enums'

const ROLE_INT_TO_STR: Record<number, string> = Object.fromEntries(
  Object.entries(AdminRole).map(([k, v]) => [v as number, k])
)

interface Claims {
  sub: string
  jti: string
  email: string
  roles: string[]
  exp: number
}

interface AuthState {
  token: string | null
  claims: Claims | null
  setToken: (token: string, apiRoles?: number[]) => void
  clear: () => void
}

export const useAuth = create<AuthState>((set, get) => ({
  token: null,
  claims: null,
  setToken: (token, apiRoles?) => {
    const parsed = parseClaims(token)
    const roles = apiRoles
      ? apiRoles.map((r) => ROLE_INT_TO_STR[r]).filter(Boolean)
      : (get().claims?.roles ?? parsed?.roles ?? [])
    set({ token, claims: parsed ? { ...parsed, roles } : null })
  },
  clear: () => set({ token: null, claims: null }),
}))
