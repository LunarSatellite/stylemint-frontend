# Form Patterns — stylemint-creator-fe

Forms use React Hook Form v7 + Zod. Never use uncontrolled inputs outside of RHF. Never build manual validation logic — always use Zod schemas.

---

## Standard Form Setup

```tsx
// 1. Define schema next to the form component
const analyzeSchema = z.object({
  caption:  z.string().min(1, 'Caption is required').max(2200, 'Caption too long'),
  hashtags: z.array(z.string()).max(30, 'Maximum 30 hashtags'),
  audioId:  z.string().uuid().optional(),
})

type AnalyzeFormValues = z.infer<typeof analyzeSchema>

// 2. Set up the form
export function AnalyzeDraftForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<AnalyzeFormValues>({
    resolver: zodResolver(analyzeSchema),
    defaultValues: { caption: '', hashtags: [], audioId: undefined },
  })

  const analyze = useAnalyzeDraft()

  const onSubmit = async (values: AnalyzeFormValues) => {
    try {
      await analyze.mutateAsync(values)
      reset()
    } catch (err) {
      // Field-level server errors
      if (isAxiosError(err) && err.response?.data?.errorCode === 'validation.multiple_errors') {
        err.response.data.fieldErrors?.forEach(({ field, message }: FieldError) => {
          setError(field as keyof AnalyzeFormValues, { message })
        })
        return
      }
      showErrorToast(err)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <TextInput
        label="Caption"
        error={errors.caption?.message}
        {...register('caption')}
      />
      <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
        Analyze
      </Button>
    </form>
  )
}
```

---

## Zod Schema Patterns

```ts
// Optional field that becomes undefined (not empty string) when blank
z.string().optional().or(z.literal('').transform(() => undefined))

// Positive integer from a string input
z.coerce.number().int().positive()

// Date range validation
z.object({
  from: z.string().datetime(),
  to:   z.string().datetime(),
}).refine((v) => new Date(v.to) > new Date(v.from), {
  message: 'End date must be after start date',
  path: ['to'],
})

// Analytics window — max 365 days enforced client-side
const analyticsWindowSchema = z.object({
  days: z.coerce.number().int().min(1).max(365, 'Analytics window cannot exceed 365 days'),
})
```

---

## Controlled Select / Combobox

RHF's `register` only works with native inputs. For custom components use `Controller`:

```tsx
<Controller
  control={control}
  name="arcId"
  render={({ field, fieldState }) => (
    <Select
      value={field.value}
      onChange={field.onChange}
      onBlur={field.onBlur}
      options={arcs}
      getLabel={(a) => a.title}
      getKey={(a) => a.id}
      error={fieldState.error?.message}
    />
  )}
/>
```

---

## Multi-step Forms

Use a Zustand store for multi-step form state when steps persist across navigation. Do not thread form state through React Router state.

```ts
// src/features/reel-studio/useStudioFormStore.ts
interface StudioFormStore {
  step: 1 | 2 | 3
  draft: Partial<StudioDraft>
  setStep: (step: 1 | 2 | 3) => void
  patchDraft: (patch: Partial<StudioDraft>) => void
  reset: () => void
}

export const useStudioFormStore = create<StudioFormStore>((set) => ({
  step: 1,
  draft: {},
  setStep: (step) => set({ step }),
  patchDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  reset: () => set({ step: 1, draft: {} }),
}))
```

---

## Async Validation

Use `validate` option in RHF or a `.superRefine` in Zod for async checks. Debounce at 400ms minimum:

```tsx
<Controller
  control={control}
  name="handle"
  rules={{
    validate: async (value) => {
      const available = await checkHandleAvailable(value)
      return available || 'Handle is already taken'
    },
  }}
  render={({ field, fieldState }) => (
    <TextInput {...field} error={fieldState.error?.message} label="Handle" />
  )}
/>
```

---

## Form Submission States

```tsx
// Show inline loading state on the button — do not disable the whole form
<Button
  type="submit"
  disabled={isSubmitting}
  loading={isSubmitting}       // shows spinner, preserves button width
  aria-busy={isSubmitting}
>
  {isSubmitting ? 'Analyzing…' : 'Analyze Draft'}
</Button>
```

Never use `isPending` from the mutation directly to control form state — use RHF's `isSubmitting` so the form stays coherent even if the mutation is called externally.

---

## Error Display Rules

- Field errors: displayed inline below the input via `error` prop
- Form-level errors (e.g. `validation.multiple_errors`): map to field errors via `setError`
- Network / unexpected errors: `showErrorToast(err)` — never inline in form JSX
- Never show raw server error messages — always use the `errorMessages` registry

---

## Reset After Success

Always call `reset()` after a successful mutation to clear dirty state and re-apply default values. If the form navigates away on success, reset before navigate to avoid memory leaks:

```ts
onSuccess: (data) => {
  reset()
  navigate(`/studio/${data.reelDraftId}`)
},
```
