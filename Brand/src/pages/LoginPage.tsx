import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '@/api/client'
import { useAuth } from '@/auth/store'
import { parseClaims } from '@/auth/parseClaims'
import { scheduleSilentRefresh } from '@/auth/silentRefresh'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { extractApiError } from '@/lib/extractApiError'

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

type LoginValues = z.infer<typeof LoginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setToken = useAuth((s) => s.setToken)

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<LoginValues>({
    resolver: zodResolver(LoginSchema),
  })

  async function onSubmit(values: LoginValues) {
    try {
      const { data } = await api.post<{ token: string }>('/v1/auth/login', values)
      setToken(data.token)
      const claims = parseClaims(data.token)
      scheduleSilentRefresh(claims.exp * 1000)
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/dashboard'
      navigate(from, { replace: true })
    } catch (err) {
      const { errorCode } = extractApiError(err)
      if (errorCode === 'auth.unauthorized') {
        setError('password', { message: 'Invalid email or password.' })
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] p-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 shadow-soft">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-[var(--primary)]">StyleMint</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Brand Studio</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Email
            </label>
            <Input id="email" type="email" {...register('email')} error={errors.email?.message} />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Password
            </label>
            <Input id="password" type="password" {...register('password')} error={errors.password?.message} />
          </div>

          <Button type="submit" loading={isSubmitting} className="w-full">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  )
}
