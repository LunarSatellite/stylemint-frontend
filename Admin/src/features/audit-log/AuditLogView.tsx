import { useReactTable, getCoreRowModel, type ColumnDef } from '@tanstack/react-table'
import { VirtualTable } from '@/components/VirtualTable'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/formatters'

type AuditEntry = { id: string; actor: string; action: string; timestamp: string; payloadJson: string }

const columns: ColumnDef<AuditEntry>[] = [
  { accessorKey: 'timestamp', header: 'Time', cell: ({ row }) => <span className="font-mono text-xs text-text-muted">{formatDate(row.original.timestamp)}</span> },
  { accessorKey: 'actor', header: 'Actor', cell: ({ row }) => <span className="text-text-primary">{row.original.actor}</span> },
  { accessorKey: 'action', header: 'Action' },
  { accessorKey: 'payloadJson', header: 'Payload', cell: ({ row }) => <pre className="text-text-muted text-xs max-w-xs truncate">{row.original.payloadJson}</pre> },
]

interface Props { entries: AuditEntry[]; isLoading?: boolean; hasNextPage: boolean; isFetchingNextPage: boolean; search: string; onSearchChange: (s: string) => void; onFetchMore: () => void }

export function AuditLogView({ entries, isLoading, hasNextPage, isFetchingNextPage, search, onSearchChange, onFetchMore }: Props) {
  const table = useReactTable({ data: entries, columns, getCoreRowModel: getCoreRowModel() })
  return <div className="space-y-4"><Input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search actor or action…" className="max-w-xs bg-bg-elevated border-[var(--border-primary)] text-text-primary" /><VirtualTable table={table} hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} onFetchMore={onFetchMore} /></div>
}
