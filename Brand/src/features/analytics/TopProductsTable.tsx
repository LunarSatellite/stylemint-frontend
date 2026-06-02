import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { formatDelta } from '@/lib/formatters'
import { asProductId } from '@/lib/brands'
import type { TopProductDto } from '@/api/schema'

const col = createColumnHelper<TopProductDto>()

interface TopProductsTableProps {
  products: TopProductDto[]
}

export function TopProductsTable({ products }: TopProductsTableProps) {
  const columns = useMemo(() => [
    col.accessor('productName', {
      header: 'Product',
      cell: (info) => (
        <Link
          to={`/analytics/products/${info.row.original.productId}`}
          className="text-[var(--primary)] hover:underline"
        >
          {info.getValue() ?? 'Unknown'}
        </Link>
      ),
    }),
    col.accessor('unitsSold', {
      header: 'Units',
      cell: (info) => info.getValue().toLocaleString(),
    }),
    col.accessor('revenueAmount', {
      header: 'Revenue',
      cell: (info) => (
        <MoneyDisplay amount={info.getValue()} currency={info.row.original.currency} />
      ),
    }),
    col.accessor('deltaPercent', {
      header: 'vs Prior',
      cell: (info) => (
        <span className={info.getValue() != null && info.getValue()! >= 0 ? 'text-emerald-400' : 'text-red-400'}>
          {formatDelta(info.getValue() ?? null)}
        </span>
      ),
    }),
  ], [])

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Top Products</p>
      <DataTable data={products} columns={columns} />
    </div>
  )
}
