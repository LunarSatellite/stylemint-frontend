import { useReactTable, getCoreRowModel, type ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { X, Loader2, ScrollText } from 'lucide-react'
import { VirtualTable } from '@/components/VirtualTable'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/formatters'
import type { AdminAuditEntryDto } from '@/api/schema'

type AuditEntry = AdminAuditEntryDto

function shortId(id?: string | null) {
  if (!id) return '—'
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

const TARGET_KIND_LABEL: Record<string, string> = {
  KycApplication:     'KYC Application',
  CreatorApplication: 'Creator Application',
  VendorApplication:  'Vendor Application',
  KycReview:          'KYC Review',
  AdminAccount:       'Admin Account',
  Payout:             'Payout',
  ModerationItem:     'Moderation Item',
  PostReport:         'Post Report',
  FeatureFlag:        'Feature Flag',
  PlatformConfig:     'Platform Config',
  AdminSession:       'Admin Session',
}

function formatKind(kind: string): string {
  return TARGET_KIND_LABEL[kind] ?? kind.replace(/([A-Z])/g, ' $1').trim()
}

function targetPath(kind: string, id: string): string | null {
  switch (kind) {
    case 'KycApplication':
    case 'CreatorApplication':
    case 'VendorApplication':  return `/kyc/${id}`
    case 'KycReview':          return `/kyc/${id}`
    case 'AdminAccount':       return `/admins/${id}`
    case 'Payout':             return `/payouts`
    case 'ModerationItem':     return `/moderation/${id}`
    default:                   return null
  }
}

function PayloadCell({ json }: { json?: string | null }) {
  if (!json) return <span className="text-text-muted text-xs">—</span>
  try {
    const obj = JSON.parse(json)
    const entries = Object.entries(obj)
    if (entries.length === 0) return <span className="text-text-muted text-xs italic">empty</span>
    const summary = entries
      .map(([k, v]) => {
        const val = typeof v === 'object' ? JSON.stringify(v) : String(v)
        return `${k}: ${val}`
      })
      .join('  ·  ')
    return (
      <span className="block max-w-[260px] truncate font-mono text-xs text-text-muted" title={summary}>
        {summary}
      </span>
    )
  } catch {
    return (
      <span className="block max-w-[260px] truncate font-mono text-xs text-text-muted" title={json}>
        {json}
      </span>
    )
  }
}

interface Props {
  entries:              AuditEntry[]
  isLoading?:           boolean
  hasNextPage:          boolean
  isFetchingNextPage:   boolean
  actionFilter:         string
  adminAccountIdFilter: string
  targetKindFilter:     string
  targetIdFilter:       string
  fromDateFilter:       string
  toDateFilter:         string
  hasActiveFilters:     boolean
  adminIdValid:         boolean
  meId?:                string
  meName?:              string
  onActionChange:         (v: string) => void
  onAdminAccountIdChange: (v: string) => void
  onTargetKindChange:     (v: string) => void
  onTargetIdChange:       (v: string) => void
  onFromDateChange:       (v: string) => void
  onToDateChange:         (v: string) => void
  onClearFilters:         () => void
  onFetchMore:            () => void
}

const inputCls = 'border-[var(--border-primary)] bg-bg-elevated text-text-primary placeholder:text-text-muted'
const dateCls  = 'h-9 rounded-md border border-[var(--border-primary)] bg-bg-elevated px-3 text-[13px] text-text-primary [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-primary/40'

export function AuditLogView({
  entries, isLoading, hasNextPage, isFetchingNextPage,
  actionFilter, adminAccountIdFilter, targetKindFilter, targetIdFilter, fromDateFilter, toDateFilter,
  hasActiveFilters, adminIdValid, meId, meName,
  onActionChange, onAdminAccountIdChange, onTargetKindChange, onTargetIdChange,
  onFromDateChange, onToDateChange, onClearFilters, onFetchMore,
}: Props) {

  const columns: ColumnDef<AuditEntry>[] = [
    {
      accessorKey: 'occurredUtc',
      header: 'Time',
      size: 160,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-text-muted whitespace-nowrap">
          {row.original.occurredUtc ? formatDate(row.original.occurredUtc) : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'adminAccountId',
      header: 'Admin',
      size: 160,
      cell: ({ row }) => {
        const id = row.original.adminAccountId
        if (!id) return <span className="text-text-muted text-xs">—</span>
        if (id === meId) {
          return (
            <div className="flex flex-col gap-[2px]">
              <span
                className="inline-flex w-fit items-center rounded-full px-[8px] py-[2px] text-[11px] font-semibold"
                style={{ background: 'rgba(0,217,138,0.1)', color: '#00D98A' }}
              >
                You
              </span>
              {meName && (
                <span className="text-[11px] text-text-muted truncate max-w-[140px]">{meName}</span>
              )}
            </div>
          )
        }
        return (
          <Link
            to={`/admins/${id}`}
            title={id}
            className="font-mono text-xs text-text-secondary underline-offset-2 hover:text-primary hover:underline transition-colors"
          >
            {shortId(id)}
          </Link>
        )
      },
    },
    {
      accessorKey: 'action',
      header: 'Action',
      size: 200,
      cell: ({ row }) => (
        <span className="text-[13px] text-text-primary">{row.original.action ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'targetKind',
      header: 'Target',
      size: 220,
      cell: ({ row }) => {
        const { targetKind, targetId } = row.original
        if (!targetKind) return <span className="text-text-muted text-xs">—</span>
        const path = targetId ? targetPath(targetKind, targetId) : null
        return (
          <div className="flex flex-col gap-[2px]">
            <span className="text-[12px] font-medium text-text-secondary">{formatKind(targetKind)}</span>
            {path && (
              <Link
                to={path}
                title={targetId ?? undefined}
                className="font-mono text-[11px] text-text-muted underline-offset-2 hover:text-primary hover:underline transition-colors"
              >
                {shortId(targetId)}
              </Link>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'payloadJson',
      header: 'Payload',
      cell: ({ row }) => <PayloadCell json={row.original.payloadJson} />,
    },
  ]

  const table = useReactTable({ data: entries, columns, getCoreRowModel: getCoreRowModel() })

  return (
    <div className="space-y-4">

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-text-muted uppercase tracking-wide">Action</label>
          <Input
            value={actionFilter}
            onChange={e => onActionChange(e.target.value)}
            placeholder="e.g. kyc.approved"
            className={`w-[180px] ${inputCls}`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-text-muted uppercase tracking-wide">Admin ID</label>
          <Input
            value={adminAccountIdFilter}
            onChange={e => onAdminAccountIdChange(e.target.value)}
            placeholder="UUID"
            className={`w-[220px] ${inputCls} ${!adminIdValid ? 'border-amber-400/40' : ''}`}
          />
          {!adminIdValid && (
            <span className="text-[11px] text-amber-400">Enter a complete UUID</span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-text-muted uppercase tracking-wide">Target Kind</label>
          <Input
            value={targetKindFilter}
            onChange={e => onTargetKindChange(e.target.value)}
            placeholder="e.g. KycApplication"
            className={`w-[180px] ${inputCls}`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-text-muted uppercase tracking-wide">Target ID</label>
          <Input
            value={targetIdFilter}
            onChange={e => onTargetIdChange(e.target.value)}
            placeholder="UUID"
            className={`w-[220px] ${inputCls}`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-text-muted uppercase tracking-wide">From</label>
          <input
            type="date"
            value={fromDateFilter}
            onChange={e => onFromDateChange(e.target.value)}
            className={dateCls}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-text-muted uppercase tracking-wide">To</label>
          <input
            type="date"
            value={toDateFilter}
            onChange={e => onToDateChange(e.target.value)}
            className={dateCls}
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="flex h-9 items-center gap-1.5 rounded-md border border-white/[0.07] px-3 text-[12px] font-medium text-text-muted transition-colors hover:border-white/[0.12] hover:text-text-secondary"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-text-muted">
          <ScrollText className="h-10 w-10 opacity-20" />
          <span className="text-[13px]">No audit entries match the current filters</span>
        </div>
      ) : (
        <VirtualTable
          table={table}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onFetchMore={onFetchMore}
        />
      )}
    </div>
  )
}
