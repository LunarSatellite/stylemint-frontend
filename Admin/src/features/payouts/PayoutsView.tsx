import { useReactTable, getCoreRowModel, type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { PayoutStateLabel, formatDate } from '@/lib/formatters'
import type { PayoutDto } from '@/api/schema'

type Payout = PayoutDto

const columns: ColumnDef<Payout>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: ({ row }) => <span className="font-mono text-xs text-text-muted">{row.original.id}</span>,
  },
  {
    accessorKey: 'payeeProfileId',
    header: 'Payee',
    cell: ({ row }) => <span className="font-mono text-xs text-text-muted">{row.original.payeeProfileId}</span>,
  },
  {
    accessorKey: 'requestedAmountValue',
    header: 'Amount',
    cell: ({ row }) => {
      const currency = row.original.requestedAmountCurrency ?? 'USD'
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(row.original.requestedAmountValue)
    },
  },
  {
    accessorKey: 'state',
    header: 'Status',
    cell: ({ row }) => PayoutStateLabel[row.original.state] ?? row.original.state,
  },
  {
    accessorKey: 'requestedUtc',
    header: 'Requested',
    cell: ({ row }) => formatDate(row.original.requestedUtc),
  },
]

interface Props {
  data: Payout[]
  isLoading?: boolean
  hasNext: boolean
  hasPrev: boolean
  onNext: () => void
  onPrev: () => void
}

export function PayoutsView({ data, isLoading, hasNext, hasPrev, onNext, onPrev }: Props) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })
  return (
    <div className="space-y-4">
      <DataTable table={table} isLoading={isLoading} />
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}
