import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import { KycDecisionForm } from './KycDecisionForm'

export function KycDetailContainer({ id }: { id: string }) {
  const { data, isLoading } = useQuery({ queryKey: qk.kyc.detail(id), queryFn: async () => { const { data } = await api.get(`/v1/admin/kyc/${id}`); return data }, staleTime: 10_000 })
  if (isLoading) return <div className="text-text-muted">Loading…</div>
  if (!data) return null
  return (
    <div className="space-y-6">
      <div className="bg-bg-card border border-[var(--surface-border)] rounded-lg p-6">{/* applicant details */}</div>
      <KycDecisionForm id={id} />
    </div>
  )
}
