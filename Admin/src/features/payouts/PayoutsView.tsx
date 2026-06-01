import { useReactTable, getCoreRowModel, type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { Input } from '@/components/ui/input'
import { PayoutStateLabel, formatCurrency } from '@/lib/formatters'

type Payout = { id: string; amount: number; currency: string; state: number; createdAt: string }
const columns: ColumnDef<Payout>[] = [
  { accessorKey: 'id', header: 'ID', cell: ({ row }) => <span className="font-mono text-xs text-text-muted">{row.original.id}</span> },
  { accessorKey: 'amount', header: 'Amount', cell: ({ row }) => formatCurrency(row.original.amount, row.original.currency) },
  { accessorKey: 'state', header: 'Status', cell: ({ row }) => PayoutStateLabel[row.original.state] },
]

interface Props { data: Payout[]; total: number; page: number; pageSize: number; search: string; isLoading?: boolean; onPageChange: (p: number) => void; onSearchChange: (s: string) => void }

export function PayoutsView({ data, total, page, pageSize, search, isLoading, onPageChange, onSearchChange }: Props) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel(), manualPagination: true, rowCount: total, state: { pagination: { pageIndex: page - 1, pageSize } }, onPaginationChange: (u) => { const n = typeof u === 'function' ? u({ pageIndex: page - 1, pageSize }) : u; onPageChange(n.pageIndex + 1) } })
  return <div className="space-y-4"><Input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search payouts…" className="max-w-xs bg-bg-elevated border-[var(--border-primary)] text-text-primary" /><DataTable table={table} isLoading={isLoading} /></div>
}
