import { VendorActivityKind } from '@/lib/enums'
import type { ValueOf } from '@/lib/types'
import type { ActivityFilter } from '@/api/queryKeys'

const kindLabels: Partial<Record<ValueOf<typeof VendorActivityKind>, string>> = {
  [VendorActivityKind.OrderReceived]:      'Orders',
  [VendorActivityKind.PartnershipRequest]: 'Partnerships',
  [VendorActivityKind.PayoutReceived]:     'Payouts',
  [VendorActivityKind.ProductAdded]:       'Products',
}

interface ActivityFiltersProps {
  filter:    ActivityFilter
  onChange:  (f: ActivityFilter) => void
}

export function ActivityFilters({ filter, onChange }: ActivityFiltersProps) {
  function toggleKind(kind: ValueOf<typeof VendorActivityKind>) {
    const current = filter.kind ?? []
    const next = current.includes(kind)
      ? current.filter((k) => k !== kind)
      : [...current, kind]
    onChange({ ...filter, kind: next.length ? next : undefined })
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(Object.entries(kindLabels) as [string, string][]).map(([value, label]) => {
        const kind = Number(value) as ValueOf<typeof VendorActivityKind>
        const active = filter.kind?.includes(kind) ?? false
        return (
          <button
            key={value}
            onClick={() => toggleKind(kind)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? 'bg-[var(--primary)] text-[var(--bg-primary)]'
                : 'border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
            }`}
          >
            {label}
          </button>
        )
      })}
      {(filter.kind?.length ?? 0) > 0 && (
        <button
          onClick={() => onChange({ ...filter, kind: undefined })}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        >
          Clear
        </button>
      )}
    </div>
  )
}
