# Form Patterns — stylemint-brand-fe

React Hook Form + Zod wiring. Read this before building any form.

---

## Standard form setup

```ts
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const BriefDraftSchema = z.object({
  title:          z.string().min(1, 'Title is required').max(120),
  targetAudience: z.string().min(1, 'Audience is required'),
  goalType:       z.number({ required_error: 'Select a goal' }),
  commissionRate: z.number().min(0).max(1),  // fraction [0,1] — display ×100
})

type BriefDraftValues = z.infer<typeof BriefDraftSchema>

function BriefDraftForm({ brief }: { brief: BrandBriefDto }) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, dirtyFields, isSubmitting },
  } = useForm<BriefDraftValues>({
    resolver: zodResolver(BriefDraftSchema),
    defaultValues: {
      title:          brief.title,
      targetAudience: brief.targetAudience,
      goalType:       brief.goalType,
      commissionRate: brief.commissionRate,
    },
  })

  const updateBrief = useUpdateBrief()

  async function onSubmit(values: BriefDraftValues) {
    await updateBrief.mutateAsync({
      id:   brief.id,
      body: buildPatchBody(values, dirtyFields, brief.rowVersion),
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      ...
      <button type="submit" disabled={isSubmitting}>Save</button>
    </form>
  )
}
```

`noValidate` disables native browser validation — Zod handles it.

---

## Field registration — `register` vs `Controller`

Use `register` for native HTML inputs (text, number, textarea, checkbox):

```tsx
<div className="flex flex-col gap-1">
  <label htmlFor="title" className="text-sm font-medium text-[var(--text-primary)]">
    Title
  </label>
  <Input
    id="title"
    {...register('title')}
    aria-describedby={errors.title ? 'title-error' : undefined}
    aria-invalid={!!errors.title}
  />
  {errors.title && (
    <span id="title-error" role="alert" className="text-xs text-red-400">
      {errors.title.message}
    </span>
  )}
</div>
```

Use `Controller` for Radix UI primitives (Select, Checkbox, Switch, RadioGroup) that don't expose a native ref:

```tsx
<Controller
  name="goalType"
  control={control}
  render={({ field, fieldState }) => (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-[var(--text-primary)]">Goal</label>
      <Select
        value={field.value?.toString() ?? ''}
        onValueChange={(v) => field.onChange(Number(v))}
      >
        <SelectTrigger aria-invalid={!!fieldState.error}>
          <SelectValue placeholder="Select a goal…" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(CampaignGoal).map(([label, value]) => (
            <SelectItem key={value} value={value.toString()}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {fieldState.error && (
        <span role="alert" className="text-xs text-red-400">
          {fieldState.error.message}
        </span>
      )}
    </div>
  )}
/>
```

---

## Validation error display rules

- Field errors display **inline**, below the input — never as a toast
- Use `role="alert"` so screen readers announce the error immediately
- Use `aria-invalid` on the input to signal the error state to assistive tech
- Use `aria-describedby` linking input → error element for full screen reader context
- `validation.multiple_errors` from the API → display as a top-of-form banner, not individual field errors (server-returned errors are not in `fieldErrors`)

```tsx
{updateBrief.error && (
  <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
    {errorMessages[updateBrief.error.errorCode] ?? errorMessages['system.internal_error']}
  </div>
)}
```

---

## dirtyFields-only PATCH

Brief PATCH sends **only the fields the user changed**, not the full form value.
Also always include `rowVersion` for optimistic concurrency.

```ts
import type { FieldNamesMarkedBoolean, FieldValues } from 'react-hook-form'

function buildPatchBody<T extends FieldValues>(
  values: T,
  dirtyFields: Partial<FieldNamesMarkedBoolean<T>>,
  rowVersion: number,
): Partial<T> & { rowVersion: number } {
  const patch = Object.fromEntries(
    Object.entries(dirtyFields)
      .filter(([, dirty]) => dirty)
      .map(([key]) => [key, values[key as keyof T]])
  ) as Partial<T>

  return { ...patch, rowVersion }
}
```

Usage in `onSubmit`:

```ts
async function onSubmit(values: BriefDraftValues) {
  if (Object.keys(dirtyFields).length === 0) return  // nothing changed
  await updateBrief.mutateAsync({
    id:   brief.id,
    body: buildPatchBody(values, dirtyFields, brief.rowVersion),
  })
}
```

Never send the full object — the endpoint only accepts fields that were intentionally changed.

---

## Rate-limit on submit

When the mutation returns `system.rate_limited`, read `Retry-After` and disable the submit button for that duration.

```ts
const [retryAfter, setRetryAfter] = useState(0)

useEffect(() => {
  if (retryAfter <= 0) return
  const id = setInterval(() => setRetryAfter((s) => Math.max(0, s - 1)), 1000)
  return () => clearInterval(id)
}, [retryAfter])

// In mutation onError:
if (error.errorCode === 'system.rate_limited') {
  const seconds = error.retryAfterSeconds ?? 30
  setRetryAfter(seconds)
  toast.error(`Too many requests. Try again in ${seconds}s.`)
  return
}

// On the button:
<button
  type="submit"
  disabled={isSubmitting || retryAfter > 0}
>
  {retryAfter > 0 ? `Wait ${retryAfter}s` : 'Save'}
</button>
```

---

## Commission / rate field display

API stores commission as a fraction `[0,1]`. Display and edit as a percentage `[0,100]`.
Transform at the form boundary — never in the schema.

```tsx
// defaultValues: divide by 100
defaultValues: { commissionRate: brief.commissionRate * 100 }

// onSubmit: multiply back
body: { commissionRate: values.commissionRate / 100, rowVersion: brief.rowVersion }

// Input label
<label>Commission (%)</label>
<Input type="number" min={0} max={100} step={0.1} {...register('commissionRate', { valueAsNumber: true })} />
```

---

## Multi-step / wizard forms

Use a single `useForm` at the wizard root. Pass `control` and `register` down to step components — never split into multiple `useForm` instances.

```ts
// WizardRoot.tsx — owns the single form
const form = useForm<WizardValues>({ resolver: zodResolver(WizardSchema) })

// Step components receive slices of the form
<StepOne control={form.control} errors={form.formState.errors} />
<StepTwo control={form.control} errors={form.formState.errors} />

// Trigger validation for only the current step's fields before advancing
const stepOneFields: (keyof WizardValues)[] = ['title', 'goalType']
const isValid = await form.trigger(stepOneFields)
if (isValid) goToNextStep()
```

---

## Hard rules

- Never `useState` for form field values — always React Hook Form
- Never toast for field validation errors — display inline
- Never send the full form body on PATCH — use `dirtyFields` + `buildPatchBody`
- Always include `rowVersion` on PATCH/lock/fork/retire
- `noValidate` on every `<form>` — Zod handles validation
- Commission / rate fields: API = fraction, display = percent — transform at form boundary
- Disable submit on `isSubmitting` and during `retryAfter` countdown
