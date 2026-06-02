import { create } from 'zustand'
import { parseClaims, type JwtClaims } from './parseClaims'

interface AuthState {
  token: string | null
  claims: JwtClaims | null
  briefingLoading: boolean
  setToken: (token: string) => void
  setBriefingLoading: (v: boolean) => void
  clear: () => void
}

export const useAuth = create<AuthState>((set) => ({
  token:           null,
  claims:          null,
  briefingLoading: false,
  setToken: (token) => set({ token, claims: parseClaims(token) }),
  setBriefingLoading: (v) => set({ briefingLoading: v }),
  clear: () => set({ token: null, claims: null }),
}))
