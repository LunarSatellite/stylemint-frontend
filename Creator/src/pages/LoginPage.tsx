import { useSearchParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useAuth } from '@/auth/store'
import { showErrorToast } from '@/api/errors'
import { safePath } from '@/auth/guards'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { LoginResponse } from '@/api/schema'

const loginSchema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type LoginValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const setToken = useAuth((s) => s.setToken)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  })

  const { mutateAsync: login } = useMutation({
    mutationFn: (values: LoginValues) =>
      api.post<LoginResponse>('/v1/auth/login', values).then((r) => r.data),
  })

  const onSubmit = async (values: LoginValues) => {
    try {
      const { token } = await login(values)
      setToken(token)
      navigate(safePath(searchParams.get('next')))
    } catch (err) {
      showErrorToast(err)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary">
      <div className="w-full max-w-sm rounded-xl bg-bg-card p-8 shadow-soft">
        <h1 className="mb-6 text-xl font-bold text-text-primary">Creator Login</h1>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Input
            id="email"
            type="email"
            label="Email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            id="password"
            type="password"
            label="Password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
