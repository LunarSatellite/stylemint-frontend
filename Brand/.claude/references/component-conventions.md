# Component Conventions — stylemint-brand-fe

TypeScript patterns, component authoring rules, and accessibility standards.

---

## File structure

Single-file components live flat in `features/` or `components/ui/`.
Multi-file components use a named folder:

```
features/brief-authoring/
├── BriefEditor/
│   ├── index.ts              # re-export only: export { BriefEditor } from './BriefEditor'
│   ├── BriefEditor.tsx       # implementation
│   └── BriefEditor.test.tsx
├── BriefStatusBadge.tsx      # single file — no folder needed
└── BriefList.tsx
```

---

## Props typing

```ts
// Named interface, not inline type
interface BriefStatusBadgeProps {
  state: ValueOf<typeof BrandBriefState>
  className?: string
}

// Plain function, never React.FC
export function BriefStatusBadge({ state, className }: BriefStatusBadgeProps) {
  ...
}
```

`ValueOf<T>` utility:
```ts
// src/lib/types.ts
export type ValueOf<T> = T[keyof T]
```

---

## Branded ID types

All entity IDs from the API are branded strings. Never accept raw `string` where an ID is expected.

```ts
// src/lib/brands.ts
export type BriefId        = string & { readonly __brand: 'BriefId' }
export type VendorId       = string & { readonly __brand: 'VendorId' }
export type TemplateId     = string & { readonly __brand: 'TemplateId' }
export type PartnershipId  = string & { readonly __brand: 'PartnershipId' }
export type ProductId      = string & { readonly __brand: 'ProductId' }

// Cast once at API boundary (inside query hook), propagate branded type throughout
export const asBriefId       = (s: string): BriefId      => s as BriefId
export const asVendorId      = (s: string): VendorId     => s as VendorId
export const asTemplateId    = (s: string): TemplateId   => s as TemplateId
export const asPartnershipId = (s: string): PartnershipId => s as PartnershipId
export const asProductId     = (s: string): ProductId    => s as ProductId
```

```ts
// src/api/queries/useBriefDetail.ts — cast at boundary
const data = await api.get<BrandBriefDto>(`/v1/vendor/briefs/${id}`)
return { ...data, id: asBriefId(data.id) }

// src/features/brief-authoring/BriefEditor.tsx — receive branded type
interface BriefEditorProps { briefId: BriefId }
```

---

## Discriminated union for async state

Map TanStack Query states to a discriminated union before rendering. Exhaustive switches catch missing cases at compile time.

```ts
type BriefDetailState =
  | { status: 'loading' }
  | { status: 'error';   error: ApiError }
  | { status: 'success'; brief: BrandBriefDto }

function useBriefDetailState(id: BriefId): BriefDetailState {
  const { isPending, isError, error, data } = useBriefDetail(id)
  if (isPending) return { status: 'loading' }
  if (isError)   return { status: 'error', error }
  return { status: 'success', brief: data }
}

// In component — exhaustive switch
const state = useBriefDetailState(briefId)
switch (state.status) {
  case 'loading': return <BriefEditorSkeleton />
  case 'error':   return <PageErrorFallback error={state.error} />
  case 'success': return <BriefEditorForm brief={state.brief} />
  default: {
    const _exhaustive: never = state
    throw new Error(`Unhandled state: ${JSON.stringify(_exhaustive)}`)
  }
}
```

---

## `cn` utility

Always use `cn()` for conditional class composition. Never string-concatenate Tailwind classes.

```ts
// src/lib/cn.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))
```

```tsx
// usage
<div className={cn(
  'rounded-lg border p-4',
  isActive && 'border-[var(--border-primary)]',
  isDisabled && 'opacity-50 cursor-not-allowed',
  className   // always accept + spread external className last
)} />
```

---

## `forwardRef` pattern

Required for any component that might receive a `ref` from a parent (inputs, buttons, scroll containers).

```ts
import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends ComponentPropsWithoutRef<'input'> {
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      <input
        ref={ref}
        className={cn(
          'rounded-md border bg-[var(--surface-2)] px-3 py-2 text-sm',
          'border-[var(--border-subtle)] text-[var(--text-primary)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]',
          error && 'border-red-500',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
)
Input.displayName = 'Input'
```

Always set `displayName` — React DevTools shows it in the component tree.

---

## Compound component pattern

For complex UI with shared internal state (DataTable with toolbar, tabs, wizard steps):

```ts
// components/DataTable/DataTable.tsx
import { createContext, useContext } from 'react'
import { useReactTable, type ColumnDef, getCoreRowModel } from '@tanstack/react-table'

interface DataTableContextValue<TData> {
  table: ReturnType<typeof useReactTable<TData>>
}

const DataTableContext = createContext<DataTableContextValue<unknown> | null>(null)

function useDataTableContext<TData>() {
  const ctx = useContext(DataTableContext as React.Context<DataTableContextValue<TData> | null>)
  if (!ctx) throw new Error('DataTable compound components must be used inside <DataTable>')
  return ctx
}

function DataTable<TData>({
  data, columns, children,
}: {
  data: TData[]
  columns: ColumnDef<TData>[]
  children: React.ReactNode
}) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })
  return (
    <DataTableContext.Provider value={{ table } as DataTableContextValue<unknown>}>
      <div className="flex flex-col gap-2">{children}</div>
    </DataTableContext.Provider>
  )
}

DataTable.Toolbar    = DataTableToolbar
DataTable.Body       = DataTableBody
DataTable.Pagination = DataTablePagination

export { DataTable }
```

---

## Generic component pattern

```ts
interface SelectProps<T extends string | number> {
  options:  { label: string; value: T }[]
  value:    T | null
  onChange: (value: T) => void
  placeholder?: string
  className?: string
}

export function Select<T extends string | number>({
  options, value, onChange, placeholder = 'Select…', className,
}: SelectProps<T>) {
  ...
}
```

---

## Skeleton / loading pattern

Every page and every data-heavy widget has a skeleton with the same layout dimensions as the loaded state.

```ts
export function BriefListSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading briefs" aria-busy="true">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-16 rounded-lg bg-[var(--surface-2)] animate-pulse" />
      ))}
    </div>
  )
}
```

Rules:
- Skeletons use `var(--surface-2)` + `animate-pulse` — never a spinner for data-heavy pages
- Skeleton dimensions must match the actual content dimensions (no layout shift on load)
- Add `aria-busy="true"` and `aria-label` for screen readers

---

## Accessibility standards

### Radix primitives

Radix handles ARIA roles, keyboard navigation, and focus management for:
Dialog, AlertDialog, DropdownMenu, Select, Tooltip, Popover, Tabs, Checkbox, RadioGroup, Switch.

Do **not** re-add `role`, `aria-expanded`, or `aria-haspopup` to Radix components — they are already set internally.

### Custom interactive elements

Any non-Radix interactive element must have explicit ARIA:

```tsx
// icon-only button
<button
  onClick={onDelete}
  aria-label="Delete brief"
  className="..."
>
  <Trash2 className="h-4 w-4" aria-hidden="true" />
</button>

// custom toggle
<div
  role="switch"
  tabIndex={0}
  aria-checked={isActive}
  aria-label="Enable notifications"
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle() }}
  onClick={toggle}
/>
```

### Focus ring — never suppress

```css
/* Always use focus-visible, never plain :focus */
.focusable {
  @apply focus-visible:outline-none focus-visible:ring-2
         focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2
         focus-visible:ring-offset-[var(--bg-primary)];
}
```

`tabIndex={-1}` is only for elements that receive programmatic focus (modal panel, skip link target). Never add it to suppress tab order.

### Semantic HTML

| Instead of | Use |
|---|---|
| `<div onClick>` | `<button>` |
| `<div role="navigation">` | `<nav>` |
| `<div role="main">` | `<main>` |
| `<span onClick>` | `<button>` or `<a>` |
| `<b>` / `<i>` | `<strong>` / `<em>` |

### ECharts accessibility

ECharts canvas is not inherently accessible. Add a visually-hidden data table for screen readers alongside every chart:

```tsx
<div>
  <ReactECharts option={chartOption} style={{ height: 300 }} />
  <table className="sr-only" aria-label="Revenue trend data">
    <caption>Revenue trend — last {windowDays} days</caption>
    <thead>...</thead>
    <tbody>{dataPoints.map(...)}</tbody>
  </table>
</div>
```

---

## TypeScript strict rules

```jsonc
// tsconfig.json — non-negotiable flags
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

`noUncheckedIndexedAccess` — array access `arr[i]` returns `T | undefined`. Always guard or use `.at()`.

### Exhaustive switch assertion

```ts
function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`)
}

switch (brief.state) {
  case BrandBriefState.Draft:   return '...'
  case BrandBriefState.Locked:  return '...'
  case BrandBriefState.Retired: return '...'
  default: return assertNever(brief.state)
}
```

Add a new enum value → TypeScript compile error in every switch that doesn't handle it.
