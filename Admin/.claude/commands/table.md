# /table — Scaffold a data table

Build a data table for `$ARGUMENTS`. Choose the right base component:

- **`DataTable`** — standard offset-paginated table (most features)
- **`VirtualTable`** — audit log and any unbounded list (TanStack Virtual, 48px rows)

---

## Rules

1. Read `.claude/references/folder-structure.md` — table goes in the presentation component.
2. Read `.claude/references/design-tokens.md` — use CSS variable classes only.
3. Column definitions typed against generated schema types.
4. Debounce filter inputs 300 ms before updating query params.
5. `keepPreviousData` is set in the query hook — table never flashes on page change.

---

## DataTable template

```tsx
// src/features/<feature>/<Feature>Table.tsx
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTable } from '@/components/DataTable'
import type { components } from '@/api/schema'

type RowDto = components['schemas']['ResourceDto']

const columns: ColumnDef<RowDto>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: ({ row }) => (
      <span className="font-mono text-text-muted text-xs">{row.original.id}</span>
    ),
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <span className="text-text-primary font-medium">{row.original.name}</span>
    ),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => <RowActions row={row.original} />,
  },
]

interface FeatureTableProps {
  data: RowDto[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  isLoading?: boolean
}

export function FeatureTable({
  data,
  total,
  page,
  pageSize,
  onPageChange,
  isLoading,
}: FeatureTableProps) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: total,
    state: { pagination: { pageIndex: page - 1, pageSize } },
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function'
        ? updater({ pageIndex: page - 1, pageSize })
        : updater
      onPageChange(next.pageIndex + 1)
    },
  })

  return <DataTable table={table} isLoading={isLoading} />
}
```

---

## Filter bar with debounce

```tsx
import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'

interface FilterBarProps {
  onFilterChange: (search: string) => void
}

export function FilterBar({ onFilterChange }: FilterBarProps) {
  const [value, setValue] = useState('')

  useEffect(() => {
    const id = setTimeout(() => onFilterChange(value), 300)
    return () => clearTimeout(id)
  }, [value, onFilterChange])

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Search…"
      className="max-w-xs bg-bg-elevated border-[var(--border-primary)] text-text-primary"
    />
  )
}
```

---

## VirtualTable template (audit log)

```tsx
// src/features/audit-log/AuditLogTable.tsx
import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { VirtualTable } from '@/components/VirtualTable'
import type { components } from '@/api/schema'

const ROW_HEIGHT = 48

type AuditEntry = components['schemas']['AuditLogEntryDto']

const columns: ColumnDef<AuditEntry>[] = [
  {
    accessorKey: 'timestamp',
    header: 'Time',
    cell: ({ row }) => (
      <span className="text-text-muted text-xs font-mono">
        {formatDate(row.original.timestamp)}
      </span>
    ),
  },
  {
    accessorKey: 'actor',
    header: 'Actor',
    cell: ({ row }) => <span className="text-text-primary">{row.original.actor}</span>,
  },
  {
    accessorKey: 'action',
    header: 'Action',
  },
  {
    accessorKey: 'payloadJson',
    header: 'Payload',
    // IMPORTANT: render as plain text — never dangerouslySetInnerHTML
    cell: ({ row }) => (
      <pre className="text-text-muted text-xs whitespace-pre-wrap max-w-xs truncate">
        {row.original.payloadJson}
      </pre>
    ),
  },
]

interface AuditLogTableProps {
  data: AuditEntry[]
  isFetchingNextPage: boolean
  hasNextPage: boolean
  onFetchMore: () => void
}

export function AuditLogTable({
  data,
  isFetchingNextPage,
  hasNextPage,
  onFetchMore,
}: AuditLogTableProps) {
  return (
    <VirtualTable
      data={data}
      columns={columns}
      rowHeight={ROW_HEIGHT}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onFetchMore={onFetchMore}
    />
  )
}
```

---

## Status badge helper

```tsx
import { KycState, KycStateLabel } from '@/lib/enums'
import { cn } from '@/lib/utils'

const kycStateBadgeClass: Record<number, string> = {
  [KycState.Pending]:  'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
  [KycState.Approved]: 'bg-green-900/40  text-green-300  border-green-700/40',
  [KycState.Rejected]: 'bg-red-900/40    text-red-300    border-red-700/40',
}

export function KycStateBadge({ state }: { state: number }) {
  return (
    <span className={cn(
      'px-2 py-0.5 rounded text-xs font-medium border',
      kycStateBadgeClass[state]
    )}>
      {KycStateLabel[state]}
    </span>
  )
}
```

---

## Invariants

- Audit log → `VirtualTable` always. Any other feature → `DataTable`.
- 300 ms debounce on ALL filter inputs before firing queries.
- `manualPagination: true` on all server-paginated tables.
- `payloadJson` in audit log → `<pre>` plain text, never HTML.
- Status badges use enum constants (`KycState.Pending`), never magic numbers.
- Column definitions typed with `ColumnDef<T>` — never untyped `any`.
