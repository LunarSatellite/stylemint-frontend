import { useReactTable, getCoreRowModel, type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { Input } from '@/components/ui/input'
import { Link } from 'react-router-dom'

type ModItem = { id: string; contentType: string; state: number; reportedAt: string }
const columns: ColumnDef<ModItem>[] = [
  { accessorKey: 'contentType', header: 'Type' },
  { accessorKey: 'state', header: 'Status' },
  { id: 'actions', header: '', cell: ({ row }) => <Link to={`/moderation/${row.original.id}`} className="text-primary text-sm">Review</Link> },
]

interface Props { data: ModItem[]; total: number; page: number; pageSize: number; search: string; isLoading?: boolean; onPageChange: (p: number) => void; onSearchChange: (s: string) => void }

export function ModerationQueueView({ data, total, page, pageSize, search, isLoading, onPageChange, onSearchChange }: Props) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel(), manualPagination: true, rowCount: total, state: { pagination: { pageIndex: page - 1, pageSize } }, onPaginationChange: (u) => { const n = typeof u === 'function' ? u({ pageIndex: page - 1, pageSize }) : u; onPageChange(n.pageIndex + 1) } })
  return <div className="space-y-4"><Input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search…" className="max-w-xs bg-bg-elevated border-[var(--border-primary)] text-text-primary" /><DataTable table={table} isLoading={isLoading} /></div>
}
