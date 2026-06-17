import { useReactTable, getCoreRowModel, type ColumnDef } from '@tanstack/react-table'
import { VirtualTable } from '@/components/VirtualTable'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/formatters'
import type { components } from '@/api/schema'

type AuditEntry = components['schemas']['StyleMint.Modules.Admin.Entity.Dtos.AdminAuditEntryDto']

const columns: ColumnDef<AuditEntry>[] = [
  {
    accessorKey: 'occurredUtc',
    header: 'Time',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-text-muted">{formatDate(row.original.occurredUtc)}</span>
    ),
  },
  {
    accessorKey: 'adminAccountId',
    header: 'Admin',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-text-primary">{row.original.adminAccountId}</span>
    ),
  },
  {
    accessorKey: 'action',
    header: 'Action',
    cell: ({ row }) => <span className="text-text-primary">{row.original.action ?? '—'}</span>,
  },
  {
    accessorKey: 'targetKind',
    header: 'Target',
    cell: ({ row }) => (
      <span className="text-text-secondary">
        {row.original.targetKind ?? '—'}
        {row.original.targetId ? ` · ${row.original.targetId}` : ''}
      </span>
    ),
  },
  {
    accessorKey: 'payloadJson',
    header: 'Payload',
    cell: ({ row }) => (
      <pre className="max-w-xs truncate text-xs text-text-muted">{row.original.payloadJson ?? '—'}</pre>
    ),
  },
]

interface Props {
  entries: AuditEntry[]
  isLoading?: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  actionFilter: string
  onActionFilterChange: (s: string) => void
  onFetchMore: () => void
}

export function AuditLogView({ entries, isLoading, hasNextPage, isFetchingNextPage, actionFilter, onActionFilterChange, onFetchMore }: Props) {
  const table = useReactTable({ data: entries, columns, getCoreRowModel: getCoreRowModel() })
  return (
    <div className="space-y-4">
      <Input
        value={actionFilter}
        onChange={(e) => onActionFilterChange(e.target.value)}
        placeholder="Filter by action…"
        className="max-w-xs border-[var(--border-primary)] bg-bg-elevated text-text-primary"
      />
      <VirtualTable
        table={table}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onFetchMore={onFetchMore}
      />
    </div>
  )
}
