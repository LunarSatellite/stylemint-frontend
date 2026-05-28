# /mutation — Scaffold a mutation hook

Create a mutation hook for the write operation described in `$ARGUMENTS`.

---

## Rules

1. Read `.claude/references/query-keys.md` — use the mutation→invalidation map.
2. Read `CLAUDE.md` step-up section — check if this endpoint requires step-up.
3. Read `.claude/references/error-codes.md` — handle `state.concurrency_conflict` and `system.rate_limited`.
4. File goes in `src/api/mutations/use<ActionName>.ts`.

---

## Standard mutation template

```ts
// src/api/mutations/use<ActionName>.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { components } from '@/api/schema'

type ActionRequest  = components['schemas']['ActionRequest']
type ActionResponse = components['schemas']['ActionResponse']

async function doAction(vars: ActionRequest): Promise<ActionResponse> {
  const { data } = await api.post<ActionResponse>('/v1/admin/resource/action', vars)
  return data
}

export function useActionName(options?: {
  onSuccess?: (data: ActionResponse) => void
  onError?: (err: unknown) => void
}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: doAction,
    onSuccess: (data, vars) => {
      // invalidate narrowest keys first
      qc.invalidateQueries({ queryKey: qk.resource(vars.id) })
      qc.invalidateQueries({ queryKey: qk.resources({} as any), exact: false })
      options?.onSuccess?.(data)
    },
    onError: options?.onError,
  })
}
```

---

## Step-up mutation template

Use this when the endpoint is in the step-up list from CLAUDE.md.

```ts
// src/api/mutations/use<StepUpAction>.ts
import { useMutationWithStepUp } from '@/auth/useMutationWithStepUp'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { components } from '@/api/schema'

type ActionRequest  = components['schemas']['ActionRequest']
type ActionResponse = components['schemas']['ActionResponse']

export function useStepUpAction(options?: {
  onSuccess?: (data: ActionResponse) => void
  onError?: (err: unknown) => void
}) {
  const qc = useQueryClient()
  return useMutationWithStepUp<ActionResponse, ActionRequest>(
    async (vars) => {
      const { data } = await api.post<ActionResponse>('/v1/admin/resource/step-up-action', vars)
      return data
    },
    {
      onSuccess: (data, vars) => {
        qc.invalidateQueries({ queryKey: qk.resource(vars.id) })
        options?.onSuccess?.(data)
      },
    }
  )
}
```

---

## Optimistic mutation template (KYC / Moderation queues)

```ts
export function useKycDecide(filter: KycQueueFilter, options?: { onSuccess?: () => void }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: KycDecideRequest) => {
      const { data } = await api.post('/v1/admin/kyc/decide', vars)
      return data
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.kyc.queue(filter) })
      const prev = qc.getQueryData(qk.kyc.queue(filter))
      qc.setQueryData(qk.kyc.queue(filter), (old: any) =>
        old?.items?.map((item: any) =>
          item.id === vars.id ? { ...item, state: vars.state } : item
        )
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(qk.kyc.queue(filter), ctx?.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.kyc.queue(filter) })
      qc.invalidateQueries({ queryKey: qk.kyc.detail(/* id */ '') })
    },
    onSuccess: options?.onSuccess,
  })
}
```

---

## Error handling in mutation callers (component side)

```tsx
const mutation = useActionName({
  onSuccess: () => toast.success('Action completed'),
  onError:   showErrorToast,   // always — includes correlationId
})
```

## Rate limit pattern

```ts
onError: (err: unknown) => {
  const code = (err as any)?.response?.data?.errorCode
  if (code === 'system.rate_limited') {
    const retryAfter = Number((err as any)?.response?.headers['retry-after']) || 30
    setDisabledUntil(Date.now() + retryAfter * 1000)
    toast.warning(`Too many requests. Try again in ${retryAfter}s.`)
    return
  }
  showErrorToast(err)
},
```

---

## Invariants

- Step-up endpoints → `useMutationWithStepUp`, never plain `useMutation`
- Always invalidate narrowest key first, then broader
- Optimistic updates required for KYC and moderation queue mutations
- `onError: showErrorToast` is the default — never swallow errors silently
- Idempotency-Key is injected automatically by the axios interceptor — do not add it manually
