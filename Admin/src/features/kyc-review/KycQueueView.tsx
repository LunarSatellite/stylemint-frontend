import { useReactTable, getCoreRowModel, type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { Input } from '@/components/ui/input'
import { Link } from 'react-router-dom'
import { KycStateLabel } from '@/lib/formatters'
import { formatDate } from '@/lib/formatters'

type KycItem = { id: string; applicantName: string; state: number; submittedAt: string }

const columns: ColumnDef<KycItem>[] = [
  { accessorKey: 'applicantName', header: 'Applicant' },
  { accessorKey: 'state', header: 'Status', cell: ({ row }) => KycStateLabel[row.original.state] },
  { accessorKey: 'submittedAt', header: 'Submitted', cell: ({ row }) => formatDate(row.original.submittedAt) },
  { id: 'actions', header: '', cell: ({ row }) => <Link to={`/kyc/${row.original.id}`} className="text-primary text-sm">Review</Link> },
]

interface KycQueueViewProps {
  data: KycItem[]; total: number; page: number; pageSize: number
  search: string; isLoading?: boolean
  onPageChange: (p: number) => void; onSearchChange: (s: string) => void
}

export function KycQueueView({ data, total, page, pageSize, search, isLoading, onPageChange, onSearchChange }: KycQueueViewProps) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel(), manualPagination: true, rowCount: total, state: { pagination: { pageIndex: page - 1, pageSize } }, onPaginationChange: (u) => { const n = typeof u === 'function' ? u({ pageIndex: page - 1, pageSize }) : u; onPageChange(n.pageIndex + 1) } })
  return (
    <div className="space-y-4">
      <Input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search applicants…" className="max-w-xs bg-bg-elevated border-[var(--border-primary)] text-text-primary" />
      <DataTable table={table} isLoading={isLoading} />
    </div>
  )
}
