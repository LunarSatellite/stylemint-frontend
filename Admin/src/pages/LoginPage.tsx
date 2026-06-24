import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { PhoneMockupAnimation } from '@/components/PhoneMockupAnimation'
import { buildIdpAuthUrl, isSsoConfigured } from '@/auth/silentRefresh'
import { useSsoLogin } from '@/api/mutations/useSsoLogin'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { AdminMfaStatusDto } from '@/api/schema'
import { AlertCircle, Building2, FlaskConical, Eye, EyeOff } from 'lucide-react'

const REASON_MESSAGES: Record<string, string> = {
  expired:          'Your session expired. Please sign in again.',
  revoked:          'Your session was revoked. Please sign in again.',
  security:         'A security event was detected. Please sign in again.',
  sso_failed:       'Sign-in failed. Please try again.',
  invalid_callback: 'Invalid sign-in response. Please try again.',
  rate_limited:     'Too many sign-in attempts. Please wait and try again.',
}

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const navigate        = useNavigate()
  const queryClient     = useQueryClient()
  const login           = useSsoLogin()

  const reason       = searchParams.get('reason')
  const retryAfter   = searchParams.get('retryAfter')
  const errorMessage = reason ? (REASON_MESSAGES[reason] ?? 'Something went wrong.') : null

  // Dev-only state
  const [devSecret, setDevSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [devError, setDevError]   = useState<string | null>(null)

  function handleSsoSignIn() {
    if (!isSsoConfigured()) {
      alert('SSO is not configured. Set VITE_SSO_AUTHORITY, VITE_SSO_CLIENT_ID, and VITE_SSO_REDIRECT_URI in your .env file.')
      return
    }
    const state = crypto.randomUUID()
    sessionStorage.setItem('sso_state', state)
    window.location.assign(buildIdpAuthUrl({ state }))
  }

  async function handleDevLogin(e: React.FormEvent) {
    e.preventDefault()
    setDevError(null)
    login.mutate(devSecret.trim(), {
      onSuccess: async () => {
        try {
          const mfa = await queryClient.fetchQuery<AdminMfaStatusDto>({
            queryKey: qk.meMfa(),
            queryFn:  async () => {
              const { data } = await api.get<AdminMfaStatusDto>('/v1/admin/me/mfa')
              return data
            },
            staleTime: 30_000,
          })
          navigate(mfa.hasTotp ? '/kyc' : '/settings/mfa', { replace: true })
        } catch {
          navigate('/kyc', { replace: true })
        }
      },
      onError: (err: any) => {
        const code = err?.response?.data?.errorCode as string | undefined
        setDevError(code ?? 'Login failed. Check your dev secret.')
      },
    })
  }

  return (
    <div className="flex h-screen min-w-[1280px]">

      {/* ── Left panel ── */}
      <div
        className="flex w-[60%] shrink-0 flex-col items-center justify-center gap-7"
        style={{ background: 'radial-gradient(ellipse at 40% 50%, var(--bg-secondary) 0%, var(--bg-primary) 100%)' }}
      >
        <div className="text-center">
          <p className="mb-1.5 text-[13px] font-bold uppercase tracking-[3px] text-text-muted">
            Powering the creator economy
          </p>
          <p className="text-[15px] text-text-secondary opacity-65">
            One platform. Brands and creators, in sync.
          </p>
        </div>

        <PhoneMockupAnimation />

        <div className="flex gap-9">
          {[
            { v: '2.4K+', l: 'Creators' },
            { v: '180+',  l: 'Brands'   },
            { v: '$4.2M', l: 'GMV'      },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="text-[17px] font-extrabold text-primary">{s.v}</div>
              <div className="text-[12px] text-text-muted">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="w-px shrink-0 bg-[var(--surface-border)]" />

      {/* ── Right panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center gap-7 bg-bg-primary">

        {/* Logo */}
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] border"
            style={{
              background:  'var(--bg-secondary)',
              borderColor: 'var(--border-primary)',
              boxShadow:   '0 0 24px var(--glow-primary)',
            }}
          >
            <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
              <path d="M8 19 C8 12 11 7 19 7 C27 7 30 12 30 16 C30 21 27 23 19 23"
                    stroke="var(--primary)" strokeWidth="2.8" strokeLinecap="round" fill="none"/>
              <path d="M30 22 C30 29 27 31 19 31 C11 31 8 26 8 22 C8 17 11 15 19 15"
                    stroke="var(--primary)" strokeWidth="2.8" strokeLinecap="round" fill="none"/>
              <path d="M8 19 C8 12 11 7 19 7 C27 7 30 12 30 16 C30 21 27 23 19 23"
                    stroke="var(--primary)" strokeWidth="7" strokeLinecap="round" fill="none" strokeOpacity="0.07"/>
              <path d="M30 22 C30 29 27 31 19 31 C11 31 8 26 8 22 C8 17 11 15 19 15"
                    stroke="var(--primary)" strokeWidth="7" strokeLinecap="round" fill="none" strokeOpacity="0.07"/>
              <circle cx="19" cy="19" r="2.2" fill="var(--primary)"/>
            </svg>
          </div>
          <div>
            <div className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.3px] text-text-primary">
              StyleMint
            </div>
            <div className="mt-[3px] text-[13px] font-medium tracking-[0.02em] text-text-muted">
              Admin Portal
            </div>
          </div>
        </div>

        {/* Card */}
        <div
          className="relative w-full max-w-[400px] rounded-[18px] border px-8 py-9 shadow-soft"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--surface-3)' }}
        >
          {/* Shimmer top edge */}
          <div
            className="absolute inset-x-[10%] top-0 h-px rounded-full"
            style={{ background: 'linear-gradient(90deg, transparent, var(--border-primary), transparent)' }}
          />

          <div className="flex flex-col gap-6">

            {/* Heading */}
            <div>
              <h1 className="text-[20px] font-bold leading-[1.2] text-text-primary">
                Welcome back
              </h1>
              <p className="mt-1.5 text-[13px] text-text-muted">
                Sign in with your company account to continue.
              </p>
            </div>

            {/* Error banner (from URL reason param) */}
            {errorMessage && (
              <div
                className="flex items-start gap-2.5 rounded-lg border px-[13px] py-[10px] text-[13px] text-red-400"
                style={{ background: 'rgba(248,113,113,0.07)', borderColor: 'rgba(248,113,113,0.2)' }}
              >
                <AlertCircle size={14} className="mt-[1px] shrink-0" />
                <span>
                  {errorMessage}
                  {reason === 'rate_limited' && retryAfter && <> Retry in {retryAfter}s.</>}
                </span>
              </div>
            )}

            {/* SSO button */}
            <button
              type="button"
              onClick={handleSsoSignIn}
              className="flex w-full items-center justify-center gap-2.5 rounded-[10px] border-none bg-primary py-[13px] text-[14px] font-bold text-bg-primary transition-colors duration-[180ms] hover:bg-primary-dark"
            >
              <Building2 size={16} />
              Sign in with SSO
            </button>

            <p className="text-center text-[12px] text-text-muted">
              You will be redirected to your company's login page.
            </p>

            {/* ── Dev-only section ── only compiled in when running `vite dev` */}
            {import.meta.env.DEV && (
              <>
                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/[0.06]" />
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                    <FlaskConical size={11} />
                    Dev only
                  </span>
                  <div className="h-px flex-1 bg-white/[0.06]" />
                </div>

                <form onSubmit={handleDevLogin} className="flex flex-col gap-3">
                  <p className="text-[12px] text-text-muted">
                    Paste <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px] text-text-secondary">ADMIN_DEV_SSO_SECRET</code> from the VPS <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px] text-text-secondary">~/apps/uat/.env.uat</code>
                  </p>

                  {/* Dev error */}
                  {devError && (
                    <div
                      className="flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] text-red-400"
                      style={{ background: 'rgba(248,113,113,0.07)', borderColor: 'rgba(248,113,113,0.2)' }}
                    >
                      <AlertCircle size={12} className="mt-[1px] shrink-0" />
                      {devError}
                    </div>
                  )}

                  {/* Secret input */}
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={devSecret}
                      onChange={(e) => { setDevError(null); setDevSecret(e.target.value) }}
                      placeholder="Dev secret…"
                      required
                      className="w-full rounded-[10px] border bg-bg-elevated py-[10px] pl-[14px] pr-[42px] font-mono text-[13px] text-text-primary outline-none transition-colors duration-[180ms] placeholder:text-text-muted focus:border-[var(--border-primary)]"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret((p) => !p)}
                      className="absolute right-[11px] top-1/2 flex -translate-y-1/2 cursor-pointer items-center border-none bg-transparent p-[3px] text-text-muted"
                    >
                      {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={!devSecret.trim() || login.isPending}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-white/[0.08] bg-white/[0.04] py-[11px] text-[13px] font-semibold text-text-secondary transition-colors duration-[180ms] hover:border-white/[0.14] hover:bg-white/[0.07] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {login.isPending ? 'Signing in…' : 'Sign in with dev secret'}
                  </button>
                </form>
              </>
            )}

          </div>
        </div>

      </div>
    </div>
  )
}
