import { create } from 'zustand'
import { parseClaims } from './parseClaims'

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
  setToken: (token: string) => void
  clear: () => void
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  claims: null,
  setToken: (token) => set({ token, claims: parseClaims(token) }),
  clear: () => set({ token: null, claims: null }),
}))
