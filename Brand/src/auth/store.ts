import { create } from 'zustand'
import { parseClaims, type JwtClaims } from './parseClaims'

interface AuthState {
  token:           string | null
  claims:          JwtClaims | null
  vendorAccountId: string | null
  draftingBrief:   boolean

  setToken:           (token: string) => void
  setVendorAccountId: (id: string | null) => void
  setDraftingBrief:   (v: boolean) => void
  clear:              () => void
}

export const useAuth = create<AuthState>((set) => ({
  token:           null,
  claims:          null,
  vendorAccountId: null,
  draftingBrief:   false,

  setToken:           (token) => set({ token, claims: parseClaims(token) }),
  setVendorAccountId: (id)    => set({ vendorAccountId: id }),
  setDraftingBrief:   (v)     => set({ draftingBrief: v }),
  clear: () => set({ token: null, claims: null, vendorAccountId: null, draftingBrief: false }),
}))
