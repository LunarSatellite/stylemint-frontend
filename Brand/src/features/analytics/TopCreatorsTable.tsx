import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { formatPercent } from '@/lib/formatters'
import type { TopCreatorDto } from '@/api/schema'

const col = createColumnHelper<TopCreatorDto>()

interface TopCreatorsTableProps {
  creators:     TopCreatorDto[]
  partnershipIdByCreator?: Record<string, string>
}

export function TopCreatorsTable({ creators }: TopCreatorsTableProps) {
  const columns = useMemo(() => [
    col.accessor('creatorHandle', {
      header: 'Creator',
      cell: (info) => (
        <span className="text-[var(--text-primary)]">
          {info.getValue() ?? info.row.original.creatorAccountId.slice(0, 8)}
        </span>
      ),
    }),
    col.accessor('reelCount', {
      header: 'Reels',
      cell: (info) => info.getValue(),
    }),
    col.accessor('attributedRevenue', {
      header: 'Revenue',
      cell: (info) => (
        <MoneyDisplay amount={info.getValue()} currency={info.row.original.currency} />
      ),
    }),
    col.accessor('conversionRate', {
      header: 'CVR',
      cell: (info) => formatPercent(info.getValue()),
    }),
  ], [])

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Top Creators</p>
      <DataTable data={creators} columns={columns} />
    </div>
  )
}
