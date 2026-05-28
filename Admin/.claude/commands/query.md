# /query — Scaffold a TanStack Query useQuery hook

Create a query hook for the resource described in `$ARGUMENTS`.

---

## Rules

1. Read `.claude/references/query-keys.md` — use `qk.*` factory, never inline arrays.
2. Check the `staleTime` table — use the correct value for this resource.
3. Types come from `import type { components } from '@/api/schema'`.
4. File goes in `src/api/queries/use<ResourceName>.ts`.

---

## Template

```ts
// src/api/queries/use<ResourceName>.ts
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { components } from '@/api/schema'

type ResourceDto = components['schemas']['ResourceDto']
type ResourceFilter = {
  page: number
  pageSize: number
  // add filter fields
}

async function fetchResource(filter: ResourceFilter): Promise<ResourceDto[]> {
  const { data } = await api.get<ResourceDto[]>('/v1/admin/resource', { params: filter })
  return data
}

export function useResource(filter: ResourceFilter) {
  return useQuery({
    queryKey: qk.resource(filter),
    queryFn: () => fetchResource(filter),
    staleTime: 30_000,   // adjust to correct value from query-keys.md
  })
}
```

---

## Paginated resource template

```ts
import { keepPreviousData } from '@tanstack/react-query'

type PagedResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

async function fetchResources(filter: ResourceFilter): Promise<PagedResponse<ResourceDto>> {
  const { data } = await api.get<PagedResponse<ResourceDto>>('/v1/admin/resources', {
    params: filter,
  })
  return data
}

export function useResources(filter: ResourceFilter) {
  return useQuery({
    queryKey: qk.resources(filter),
    queryFn: () => fetchResources(filter),
    staleTime: 30_000,
    placeholderData: keepPreviousData,  // prevents loading flash during page changes
  })
}
```

---

## Detail resource template

```ts
export function useResourceDetail(id: string) {
  return useQuery({
    queryKey: qk.resource(id),
    queryFn: async () => {
      const { data } = await api.get<ResourceDto>(`/v1/admin/resources/${id}`)
      return data
    },
    staleTime: 30_000,
    enabled: Boolean(id),
  })
}
```

---

## Invariants

- Always use `qk.*` — never `['resource', filter]` inline
- `enabled: Boolean(id)` on detail hooks to prevent requests with empty id
- `keepPreviousData` on all paginated queries to avoid table flicker
- Do not add `gcTime` override unless there is an explicit reason
- Retry is handled globally — do not add `retry` override unless the resource is special
- Never put error handling in the query function itself — let React Query surface it
