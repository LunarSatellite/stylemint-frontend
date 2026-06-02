import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, Leaf } from 'lucide-react'
import { api } from '@/api/client'
import type { LoginVm, AuthResponseVm } from '@/api/schema'
import { useAuth } from '@/auth/store'
import { parseClaims } from '@/auth/parseClaims'
import { scheduleSilentRefresh } from '@/auth/silentRefresh'
import { Button } from '@/components/ui/Button'
import { extractApiError } from '@/lib/extractApiError'
import { OtpDestinationType } from '@/lib/enums'
import { cn } from '@/lib/cn'

const LoginSchema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginValues = z.infer<typeof LoginSchema>

const fieldClass = cn(
  'h-12 w-full rounded-xl border text-sm login-input',
  'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
  'border-[var(--border-subtle)] transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]',
  'focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-card)]',
)

export default function LoginPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const setToken  = useAuth((s) => s.setToken)
  const [showPw, setShowPw] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginValues>({ resolver: zodResolver(LoginSchema) })

  async function onSubmit(values: LoginValues) {
    try {
      const { data } = await api.post<AuthResponseVm>(
        '/v1/auth/login',
        {
          identifierType: OtpDestinationType.Email,
          identifier:     values.email,
          password:       values.password,
          deviceId:       null,
        } satisfies LoginVm,
      )
      if (!data.accessToken) throw new Error('No access token returned')
      setToken(data.accessToken)
      const claims = parseClaims(data.accessToken)
      scheduleSilentRefresh(claims.exp * 1000)
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/dashboard'
      navigate(from, { replace: true })
    } catch (err) {
      const { errorCode } = extractApiError(err)
      if (errorCode === 'auth.unauthorized') {
        setError('password', { message: 'Invalid email or password.' })
      } else {
        setError('password', { message: 'Something went wrong. Please try again.' })
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-primary)] p-4">

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

      {/* Login card */}
      <div className={cn(
        'w-full max-w-md rounded-2xl p-8',
        'border border-[var(--border-subtle)] bg-[var(--bg-card)]',
        'shadow-[var(--shadow-soft)]',
      )}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

          {/* Email */}
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
                {...register('email')}
                aria-invalid={errors.email ? true : undefined}
                className={cn(fieldClass, 'pl-10 pr-4', errors.email && 'border-red-500 focus-visible:ring-red-500')}
              />
            </div>
            {errors.email && (
              <span role="alert" className="text-xs text-red-400">{errors.email.message}</span>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)]">
                Password
              </label>
              <button
                type="button"
                className="text-xs text-[var(--primary)] transition-colors hover:text-[var(--primary-light)]"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                aria-invalid={errors.password ? true : undefined}
                className={cn(fieldClass, 'pl-10 pr-11', errors.password && 'border-red-500 focus-visible:ring-red-500')}
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
            {errors.password && (
              <span role="alert" className="text-xs text-red-400">{errors.password.message}</span>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            loading={isSubmitting}
            className="mt-2 h-12 w-full rounded-xl text-base font-semibold"
          >
            Sign in
          </Button>

          <p className="pt-1 text-center text-sm text-[var(--text-muted)]">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="font-medium text-[var(--primary)] transition-colors hover:text-[var(--primary-light)]"
            >
              Create one free
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
