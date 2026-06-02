import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/store'
import { PhoneMockupAnimation } from '@/components/PhoneMockupAnimation'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'

const HARDCODED_EMAIL    = 'admin@stylemint.com'
const HARDCODED_PASSWORD = 'Admin@123'

const FAKE_TOKEN = (() => {
  const header  = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    sub:   'admin-001',
    jti:   'local-jti-001',
    email: 'admin@stylemint.com',
    roles: ['SuperAdmin'],
    exp:   9999999999,
  }))
  return `${header}.${payload}.fake`
})()

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const setToken  = useAuth((s) => s.setToken)
  const navigate  = useNavigate()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (email === HARDCODED_EMAIL && password === HARDCODED_PASSWORD) {
      setToken(FAKE_TOKEN)
      navigate('/', { replace: true })
    } else {
      setError('Invalid email or password.')
    }
  }

  return (
    <div className="flex h-screen min-w-[1280px]">

      {/* Left panel */}
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

      {/* Divider */}
      <div className="w-px shrink-0 bg-[var(--surface-border)]" />

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center gap-7 bg-bg-primary">

        {/* Logo */}
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] border"
            style={{
              background:   'var(--bg-secondary)',
              borderColor:  'var(--border-primary)',
              boxShadow:    '0 0 24px var(--glow-primary)',
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
              AI-Powered Analytics
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

          <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">

            {/* Email */}
            <div className="flex flex-col gap-[7px]">
              <label className="text-[13px] font-semibold text-text-secondary">
                Email address
              </label>
              <div className="relative">
                <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setError(null); setEmail(e.target.value) }}
                  placeholder="@stylemint.com"
                  autoComplete="email"
                  required
                  className="w-full rounded-[10px] border bg-bg-elevated py-[11px] pl-[38px] pr-[14px] text-[13px] text-text-primary outline-none transition-colors duration-[180ms] placeholder:text-text-muted focus:border-[var(--border-primary)]"
                  style={{ borderColor: 'var(--border-subtle)' }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-[7px]">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-semibold text-text-secondary">
                  Password
                </label>
                <button
                  type="button"
                  className="cursor-pointer border-none bg-transparent p-0 text-[12px] font-medium text-primary"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setError(null); setPassword(e.target.value) }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-[10px] border bg-bg-elevated py-[11px] pl-[38px] pr-[42px] text-[13px] text-text-primary outline-none transition-colors duration-[180ms] placeholder:text-text-muted focus:border-[var(--border-primary)]"
                  style={{ borderColor: 'var(--border-subtle)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => !p)}
                  className="absolute right-[11px] top-1/2 flex -translate-y-1/2 cursor-pointer items-center border-none bg-transparent p-[3px] text-text-muted"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="rounded-lg border px-[13px] py-[9px] text-[13px] text-red-400"
                style={{ background: 'rgba(248,113,113,0.07)', borderColor: 'rgba(248,113,113,0.2)' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="mt-0.5 cursor-pointer rounded-[10px] border-none bg-primary py-[13px] text-[14px] font-bold text-bg-primary transition-colors duration-[180ms] hover:bg-primary-dark"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
