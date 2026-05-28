# /component — Scaffold a feature component triple

Scaffold a **Container + Presentation + Form** triple for the feature described in `$ARGUMENTS`.

---

## Rules

1. Read `.claude/references/folder-structure.md` to place the files correctly.
2. Read `.claude/references/design-tokens.md` — never hardcode hex colors.
3. Read `.claude/references/enums.md` — use enum constants, never magic numbers.

## File layout

Create three files inside `src/features/<feature-name>/`:

```
<FeatureName>Container.tsx   ← data + actions
<FeatureName>View.tsx        ← props-only rendering
<FeatureName>Form.tsx        ← RHF + Zod + mutation
```

---

## Container template

```tsx
// src/features/<feature>/FeatureContainer.tsx
import type { components } from '@/api/schema'
import { useQueryHook } from '@/api/queries/useQueryHook'
import { useMutationHook } from '@/api/mutations/useMutationHook'
import { showErrorToast } from '@/api/errors'
import { toast } from 'sonner'
import { FeatureView } from './FeatureView'

export function FeatureContainer() {
  const { data, isLoading, isError } = useQueryHook()
  const mutation = useMutationHook({
    onSuccess: () => toast.success('Done'),
    onError: showErrorToast,
  })

  if (isLoading) return <div className="p-6 text-text-muted">Loading…</div>
  if (isError)   return <div className="p-6 text-red-400">Failed to load.</div>
  if (!data)     return null

  return (
    <FeatureView
      data={data}
      onAction={(vars) => mutation.mutate(vars)}
      isSubmitting={mutation.isPending}
    />
  )
}
```

---

## Presentation template

```tsx
// src/features/<feature>/FeatureView.tsx
import type { components } from '@/api/schema'

interface FeatureViewProps {
  data: components['schemas']['FeatureDto']
  onAction: (vars: ActionVars) => void
  isSubmitting: boolean
}

export function FeatureView({ data, onAction, isSubmitting }: FeatureViewProps) {
  return (
    <div className="rounded-lg bg-bg-card border border-[var(--surface-border)] shadow-soft p-6">
      {/* render here — no useQuery or useMutation */}
    </div>
  )
}
```

---

## Form template

```tsx
// src/features/<feature>/FeatureForm.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutationHook } from '@/api/mutations/useMutationHook'
import { showErrorToast } from '@/api/errors'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const schema = z.object({
  field: z.string().min(1, 'Required'),
})

type FormValues = z.infer<typeof schema>

interface FeatureFormProps {
  onSuccess?: () => void
}

export function FeatureForm({ onSuccess }: FeatureFormProps) {
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })
  const mutation = useMutationHook({
    onSuccess: () => { toast.success('Saved'); onSuccess?.() },
    onError: showErrorToast,
  })

  return (
    <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
      <div>
        <Input {...form.register('field')} placeholder="Value" />
        {form.formState.errors.field && (
          <p className="text-red-400 text-sm mt-1">{form.formState.errors.field.message}</p>
        )}
      </div>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  )
}
```

---

## Invariants

- Container: owns all `useQuery`/`useMutation` — never in View
- View: pure render, props only, no async calls
- Form: own loading state via `mutation.isPending`, disable submit while pending
- Always pass `onError: showErrorToast` to every mutation
- Use `bg-bg-card`, `text-text-primary`, `border-[var(--surface-border)]` — never raw hex
- If the mutation is a step-up endpoint, use `useMutationWithStepUp` not `useMutation`
