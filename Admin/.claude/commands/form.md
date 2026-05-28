# /form — Scaffold a React Hook Form + Zod form

Build a validated form for `$ARGUMENTS`.

---

## Rules

1. Schema validation with Zod. Resolver via `@hookform/resolvers/zod`.
2. All field errors rendered inline below the input.
3. Submit button disabled while mutation is pending.
4. `onError: showErrorToast` on every mutation.
5. Handle `validation.multiple_errors` — set server errors on form fields.
6. Read `.claude/references/design-tokens.md` — use CSS variable classes only.

---

## Full form template

```tsx
// src/features/<feature>/<FeatureName>Form.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutationHook } from '@/api/mutations/useMutationHook'
import { showErrorToast } from '@/api/errors'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// --- Schema ---
const schema = z.object({
  name:   z.string().min(1, 'Name is required').max(100),
  email:  z.string().email('Invalid email address'),
  role:   z.number({ required_error: 'Please select a role' }),
  reason: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// --- Props ---
interface FeatureFormProps {
  defaultValues?: Partial<FormValues>
  onSuccess?: () => void
}

// --- Component ---
export function FeatureForm({ defaultValues, onSuccess }: FeatureFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const mutation = useMutationHook({
    onSuccess: () => {
      toast.success('Saved successfully')
      onSuccess?.()
    },
    onError: (err: unknown) => {
      const code = (err as any)?.response?.data?.errorCode
      if (code === 'validation.multiple_errors') {
        const serverErrors = (err as any)?.response?.data?.errors ?? []
        serverErrors.forEach(({ field, message }: { field: string; message: string }) => {
          setError(field as keyof FormValues, { message })
        })
        return
      }
      showErrorToast(err)
    },
  })

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="space-y-5"
    >
      {/* Text field */}
      <div className="space-y-1">
        <Label htmlFor="name" className="text-text-secondary">Name</Label>
        <Input
          id="name"
          {...register('name')}
          className="bg-bg-elevated border-[var(--border-primary)] text-text-primary"
          placeholder="Enter name"
        />
        {errors.name && (
          <p className="text-red-400 text-sm">{errors.name.message}</p>
        )}
      </div>

      {/* Email field */}
      <div className="space-y-1">
        <Label htmlFor="email" className="text-text-secondary">Email</Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          className="bg-bg-elevated border-[var(--border-primary)] text-text-primary"
        />
        {errors.email && (
          <p className="text-red-400 text-sm">{errors.email.message}</p>
        )}
      </div>

      {/* Select field */}
      <div className="space-y-1">
        <Label className="text-text-secondary">Role</Label>
        <Select onValueChange={(v) => setValue('role', Number(v))}>
          <SelectTrigger className="bg-bg-elevated border-[var(--border-primary)] text-text-primary">
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent className="bg-bg-elevated border-[var(--surface-border)]">
            <SelectItem value="1">Super Admin</SelectItem>
            <SelectItem value="2">KYC Reviewer</SelectItem>
          </SelectContent>
        </Select>
        {errors.role && (
          <p className="text-red-400 text-sm">{errors.role.message}</p>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onSuccess}
          className="text-text-muted"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={mutation.isPending}
          className="bg-primary hover:bg-primary-dark text-bg-primary font-medium"
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
```

---

## Textarea variant

```tsx
import { Textarea } from '@/components/ui/textarea'

<Textarea
  {...register('reason')}
  rows={4}
  className="bg-bg-elevated border-[var(--border-primary)] text-text-primary resize-none"
  placeholder="Enter reason…"
/>
```

---

## Confirm dialog pattern (destructive actions)

Wrap destructive submit in `<ConfirmDialog>`:

```tsx
import { ConfirmDialog } from '@/components/ConfirmDialog'

<ConfirmDialog
  title="Disable account?"
  description="The admin will lose access immediately."
  onConfirm={() => mutation.mutate(vars)}
  trigger={
    <Button variant="destructive" disabled={mutation.isPending}>
      Disable
    </Button>
  }
/>
```

---

## Invariants

- Zod schema defined before the component — never inline in the resolver call
- `type FormValues = z.infer<typeof schema>` — always derive, never write manually
- Server `validation.multiple_errors` → map errors to fields via `setError`
- Submit button text changes to loading state while `mutation.isPending`
- Destructive actions always use `ConfirmDialog` — no bare submit
- Never use `defaultValue` on controlled inputs when RHF is managing them
