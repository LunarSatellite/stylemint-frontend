import { useReactTable, getCoreRowModel, type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { Input } from '@/components/ui/input'
import { Link } from 'react-router-dom'
import { AdminAccountState } from '@/lib/enums'
import type { AdminAccountDto } from '@/api/schema'

const STATE_LABEL: Record<number, { label: string; className: string }> = {
  [AdminAccountState.Active]:   { label: 'Active',   className: 'text-emerald-400' },
  [AdminAccountState.Disabled]: { label: 'Disabled', className: 'text-red-400' },
}

type Admin = AdminAccountDto
const columns: ColumnDef<Admin>[] = [
  { accessorKey: 'email', header: 'Email', cell: ({ row }) => <span className="text-text-primary">{row.original.email}</span> },
  { accessorKey: 'state', header: 'Status', cell: ({ row }) => {
    const s = STATE_LABEL[row.original.state]
    return <span className={s?.className ?? 'text-text-muted'}>{s?.label ?? row.original.state}</span>
  }},
  { id: 'actions', header: '', cell: ({ row }) => <Link to={`/admins/${row.original.id}`} className="text-primary text-sm">View</Link> },
]

interface Props { data: Admin[]; total: number; page: number; pageSize: number; search: string; isLoading?: boolean; onPageChange: (p: number) => void; onSearchChange: (s: string) => void }

export function AdminAccountsView({ data, total, page, pageSize, search, isLoading, onPageChange, onSearchChange }: Props) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel(), manualPagination: true, rowCount: total, state: { pagination: { pageIndex: page - 1, pageSize } }, onPaginationChange: (u) => { const n = typeof u === 'function' ? u({ pageIndex: page - 1, pageSize }) : u; onPageChange(n.pageIndex + 1) } })
  return <div className="space-y-4"><Input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search admins…" className="max-w-xs bg-bg-elevated border-[var(--border-primary)] text-text-primary" /><DataTable table={table} isLoading={isLoading} /></div>
}
