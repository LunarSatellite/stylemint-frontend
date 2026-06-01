import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import { ModerationDecisionForm } from './ModerationDecisionForm'

export function ModerationDetailContainer({ id }: { id: string }) {
  const { data, isLoading } = useQuery({ queryKey: qk.moderation.detail(id), queryFn: async () => { const { data } = await api.get(`/v1/admin/moderation/${id}`); return data }, staleTime: 10_000 })
  if (isLoading) return <div className="text-text-muted">Loading…</div>
  if (!data) return null
  return <div className="space-y-6"><div className="bg-bg-card border border-[var(--surface-border)] rounded-lg p-6">{/* content details */}</div><ModerationDecisionForm id={id} /></div>
}
