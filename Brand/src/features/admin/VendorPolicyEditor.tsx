import { useVendorPolicy } from '@/api/queries/useVendorPolicy'
import type { VendorId } from '@/lib/brands'

interface VendorPolicyEditorProps {
  vendorProfileId: VendorId
}

export function VendorPolicyEditor({ vendorProfileId }: VendorPolicyEditorProps) {
  const { data: policy, isPending, isError } = useVendorPolicy(vendorProfileId)

  if (isPending) return <div className="p-6 text-[var(--text-muted)] animate-pulse">Loading policy…</div>
  if (isError)   return <div className="p-6 text-[var(--text-muted)]">Failed to load vendor policy.</div>

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="mb-6 text-xl font-semibold text-[var(--text-primary)]">Vendor Policy</h1>

      <div className="max-w-lg rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-3">
        <PolicyRow label="Monthly LLM Quota" value={String(policy.monthlyLlmCallQuota)} />
        <PolicyRow label="Commission Ceiling" value={`${(policy.commissionCeilingPercent * 100).toFixed(1)}%`} />
        <PolicyRow label="Default Currency" value={policy.defaultCurrencyCode ?? '—'} />
      </div>

      {/* TODO: Edit form with useUpdateVendorPolicy */}
    </div>
  )
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[var(--text-muted)]">{label}</span>
      <span className="text-sm font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  )
}
