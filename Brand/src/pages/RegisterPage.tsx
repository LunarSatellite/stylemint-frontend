import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { User, Mail, Lock, Eye, EyeOff, Leaf, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { api } from '@/api/client'
import type {
  StartRegistrationVm,
  StartRegistrationResult,
  VerifyEmailVm,
  SetPasswordVm,
  AcceptTermsVm,
} from '@/api/schema'
import { Button } from '@/components/ui/Button'
import { extractApiError } from '@/lib/extractApiError'
import { cn } from '@/lib/cn'

// ── Schemas ──────────────────────────────────────────────────────────────────

const Step1Schema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
  email:       z.string().email('Enter a valid email address'),
})

const Step2Schema = z.object({
  code: z.string().length(6, 'Enter the 6-digit code'),
})

const Step3Schema = z
  .object({
    password:        z.string().min(8, 'Min 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type Step1Values = z.infer<typeof Step1Schema>
type Step2Values = z.infer<typeof Step2Schema>
type Step3Values = z.infer<typeof Step3Schema>

// ── Shared styles ─────────────────────────────────────────────────────────────

const fieldClass = cn(
  'h-12 w-full rounded-xl border login-input text-sm',
  'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
  'border-[var(--border-subtle)] transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]',
  'focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-card)]',
)
const errorBorder = 'border-red-500 focus-visible:ring-red-500'

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS = ['Details', 'Verify email', 'Password', 'Terms']

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-6 flex items-center">
      {STEPS.map((label, i) => {
        const step   = i + 1
        const done   = step < current
        const active = step === current
        return (
          <div key={step} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all',
                done   && 'bg-[var(--primary)] text-[var(--bg-primary)]',
                active && 'bg-[var(--primary)] text-[var(--bg-primary)] shadow-[0_0_10px_var(--glow-primary)]',
                !done && !active && 'bg-[var(--surface-3)] text-[var(--text-muted)]',
              )}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : step}
              </div>
              <span className={cn(
                'text-[10px] font-medium',
                active ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]',
              )}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'mx-1 mb-5 h-px flex-1 transition-colors',
                done ? 'bg-[var(--primary)]' : 'bg-[var(--border-subtle)]',
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null
  return <span role="alert" className="text-xs text-red-400">{message}</span>
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const navigate = useNavigate()

  // Wizard state
  const [step, setStep]                       = useState(1)
  const [accountId, setAccountId]             = useState('')
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [otpExpiresAt, setOtpExpiresAt]       = useState<Date | null>(null)
  const [secondsLeft, setSecondsLeft]         = useState(0)
  const [showPw, setShowPw]                   = useState(false)
  const [showConfirm, setShowConfirm]         = useState(false)
  const [step4Loading, setStep4Loading]       = useState(false)
  const [step1Error, setStep1Error]           = useState('')
  const [step4Error, setStep4Error]           = useState('')

  // OTP expiry countdown
  useEffect(() => {
    if (!otpExpiresAt) return
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((otpExpiresAt.getTime() - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [otpExpiresAt])

  const form1 = useForm<Step1Values>({ resolver: zodResolver(Step1Schema) })
  const form2 = useForm<Step2Values>({ resolver: zodResolver(Step2Schema) })
  const form3 = useForm<Step3Values>({ resolver: zodResolver(Step3Schema) })

  // ── Step 1: start registration ──
  async function onStep1(values: Step1Values) {
    setStep1Error('')
    try {
      const { data } = await api.post<StartRegistrationResult>(
        '/v1/registration/start',
        { displayName: values.displayName, email: values.email, phoneE164: null, countryDialCode: null, locale: null, timezone: null } satisfies StartRegistrationVm,
      )
      setAccountId(data.accountId)
      setRegisteredEmail(values.email)
      setOtpExpiresAt(new Date(data.emailOtpExpiresUtc))
      setStep(2)
    } catch (err) {
      const { errorCode } = extractApiError(err)
      if (errorCode === 'auth.email_already_registered') {
        form1.setError('email', { message: 'An account with this email already exists.' })
      } else {
        setStep1Error('Something went wrong. Please try again.')
      }
    }
  }

  // ── Step 2: verify email OTP ──
  async function onStep2(values: Step2Values) {
    try {
      await api.post(`/v1/registration/${accountId}/verify-email`, {
        email: registeredEmail,
        code:  values.code,
      } satisfies VerifyEmailVm)
      setStep(3)
    } catch (err) {
      const { errorCode } = extractApiError(err)
      form2.setError('code', {
        message: errorCode === 'system.rate_limited'
          ? 'Too many attempts. Please wait.'
          : 'Invalid or expired code.',
      })
    }
  }

  // ── Step 3: set password ──
  async function onStep3(values: Step3Values) {
    try {
      await api.post(`/v1/registration/${accountId}/set-password`, { password: values.password } satisfies SetPasswordVm)
      setStep(4)
    } catch (err) {
      const { errorCode } = extractApiError(err)
      form3.setError('password', {
        message: errorCode === 'validation.multiple_errors'
          ? 'Password does not meet requirements.'
          : 'Something went wrong. Please try again.',
      })
    }
  }

  // ── Step 4: accept terms → done ──
  async function onStep4() {
    setStep4Loading(true)
    setStep4Error('')
    try {
      await api.post(`/v1/registration/${accountId}/accept-terms`, {
        consentVersion: '1.0',
        ipAddress:      null,
        userAgent:      navigator.userAgent,
      } satisfies AcceptTermsVm)
      navigate('/login', { replace: true })
    } catch {
      setStep4Error('Something went wrong. Please try again.')
    } finally {
      setStep4Loading(false)
    }
  }

  const otpMin = Math.floor(secondsLeft / 60).toString().padStart(2, '0')
  const otpSec = (secondsLeft % 60).toString().padStart(2, '0')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-primary)] p-4 py-10">

      {/* Brand mark */}
      <div className="mb-8 flex items-center gap-4">
        <div className={cn(
          'flex h-16 w-16 items-center justify-center rounded-2xl',
          'bg-[var(--bg-elevated)] ring-1 ring-[var(--border-primary)]',
          'shadow-[0_0_24px_var(--glow-primary)]',
        )}>
          <Leaf className="h-8 w-8 text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">StyleMint</h1>
          <p className="text-sm text-[var(--text-muted)]">Brand Studio</p>
        </div>
      </div>

      {/* Card */}
      <div className={cn(
        'w-full max-w-md rounded-2xl p-8',
        'border border-[var(--border-subtle)] bg-[var(--bg-card)]',
        'shadow-[var(--shadow-soft)]',
      )}>
        <div className="mb-2">
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Create your account</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Get started with Brand Studio</p>
        </div>

        <StepIndicator current={step} />

        {/* ── Step 1: Details ────────────────────────────────────────────── */}
        {step === 1 && (
          <form onSubmit={form1.handleSubmit(onStep1)} noValidate className="space-y-4">
            {step1Error && (
              <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                {step1Error}
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="displayName" className="block text-sm font-medium text-[var(--text-secondary)]">
                Display name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  id="displayName"
                  type="text"
                  placeholder="Acme Brand"
                  {...form1.register('displayName')}
                  aria-invalid={form1.formState.errors.displayName ? true : undefined}
                  className={cn(fieldClass, 'pl-10 pr-4', form1.formState.errors.displayName && errorBorder)}
                />
              </div>
              <FieldError message={form1.formState.errors.displayName?.message} />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)]">
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  {...form1.register('email')}
                  aria-invalid={form1.formState.errors.email ? true : undefined}
                  className={cn(fieldClass, 'pl-10 pr-4', form1.formState.errors.email && errorBorder)}
                />
              </div>
              <FieldError message={form1.formState.errors.email?.message} />
            </div>

            <Button
              type="submit"
              size="lg"
              loading={form1.formState.isSubmitting}
              className="mt-2 h-12 w-full rounded-xl text-base font-semibold"
            >
              Continue
            </Button>

            <button type="button" onClick={() => setStep(2)} className="w-full text-center text-xs text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--primary)]">
              Skip (dev)
            </button>

            <p className="pt-1 text-center text-sm text-[var(--text-muted)]">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="font-medium text-[var(--primary)] transition-colors hover:text-[var(--primary-light)]"
              >
                Sign in
              </button>
            </p>
          </form>
        )}

        {/* ── Step 2: Verify email OTP ────────────────────────────────────── */}
        {step === 2 && (
          <form onSubmit={form2.handleSubmit(onStep2)} noValidate className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">
              We sent a 6-digit code to{' '}
              <span className="font-medium text-[var(--text-secondary)]">{registeredEmail}</span>.
              {secondsLeft > 0 && (
                <span className="ml-2 font-medium text-[var(--primary)]">
                  Expires in {otpMin}:{otpSec}
                </span>
              )}
            </p>

            <div className="space-y-1.5">
              <label htmlFor="code" className="block text-sm font-medium text-[var(--text-secondary)]">
                Verification code
              </label>
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  {...form2.register('code')}
                  aria-invalid={form2.formState.errors.code ? true : undefined}
                  className={cn(fieldClass, 'pl-10 pr-4 tracking-[0.5em]', form2.formState.errors.code && errorBorder)}
                />
              </div>
              <FieldError message={form2.formState.errors.code?.message} />
            </div>

            <Button
              type="submit"
              size="lg"
              loading={form2.formState.isSubmitting}
              className="mt-2 h-12 w-full rounded-xl text-base font-semibold"
            >
              Verify email
            </Button>

            <button type="button" onClick={() => setStep(3)} className="w-full text-center text-xs text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--primary)]">
              Skip (dev)
            </button>

            <p className="text-center text-sm text-[var(--text-muted)]">
              Wrong email?{' '}
              <button
                type="button"
                onClick={() => setStep(1)}
                className="font-medium text-[var(--primary)] transition-colors hover:text-[var(--primary-light)]"
              >
                Go back
              </button>
            </p>
          </form>
        )}

        {/* ── Step 3: Set password ────────────────────────────────────────── */}
        {step === 3 && (
          <form onSubmit={form3.handleSubmit(onStep3)} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)]">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  {...form3.register('password')}
                  aria-invalid={form3.formState.errors.password ? true : undefined}
                  className={cn(fieldClass, 'pl-10 pr-11', form3.formState.errors.password && errorBorder)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <FieldError message={form3.formState.errors.password?.message} />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--text-secondary)]">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  {...form3.register('confirmPassword')}
                  aria-invalid={form3.formState.errors.confirmPassword ? true : undefined}
                  className={cn(fieldClass, 'pl-10 pr-11', form3.formState.errors.confirmPassword && errorBorder)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <FieldError message={form3.formState.errors.confirmPassword?.message} />
            </div>

            <Button
              type="submit"
              size="lg"
              loading={form3.formState.isSubmitting}
              className="mt-2 h-12 w-full rounded-xl text-base font-semibold"
            >
              Set password
            </Button>

            <button type="button" onClick={() => setStep(4)} className="w-full text-center text-xs text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--primary)]">
              Skip (dev)
            </button>
          </form>
        )}

        {/* ── Step 4: Accept terms ────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 text-sm leading-relaxed text-[var(--text-muted)]">
              By creating an account you agree to our{' '}
              <button type="button" className="text-[var(--primary)] transition-colors hover:text-[var(--primary-light)]">
                Terms of Service
              </button>
              {' '}and{' '}
              <button type="button" className="text-[var(--primary)] transition-colors hover:text-[var(--primary-light)]">
                Privacy Policy
              </button>
              . StyleMint will process your data to provide brand partnership services.
            </div>

            {step4Error && (
              <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                {step4Error}
              </div>
            )}

            <Button
              type="button"
              size="lg"
              loading={step4Loading}
              onClick={onStep4}
              className="h-12 w-full rounded-xl text-base font-semibold"
            >
              Create account
            </Button>

            <p className="pt-1 text-center text-sm text-[var(--text-muted)]">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="font-medium text-[var(--primary)] transition-colors hover:text-[var(--primary-light)]"
              >
                Sign in
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
