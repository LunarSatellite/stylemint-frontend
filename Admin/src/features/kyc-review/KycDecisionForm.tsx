import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useKycDecide } from '@/api/mutations/useKycDecide'
import { showErrorToast } from '@/api/errors'
import { KycState } from '@/lib/enums'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const schema = z.object({ reason: z.string().optional() })
type FormValues = z.infer<typeof schema>

export function KycDecisionForm({ id }: { id: string }) {
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })
  const decide = useKycDecide({ onSuccess: () => toast.success('Decision saved'), onError: showErrorToast })
  return (
    <div className="bg-bg-card border border-[var(--surface-border)] rounded-lg p-6 space-y-4">
      <h2 className="text-text-primary font-medium">Decision</h2>
      <div className="flex gap-3">
        <Button className="bg-primary hover:bg-primary-dark text-bg-primary" onClick={() => decide.mutate({ id, state: KycState.Approved })} disabled={decide.isPending}>Approve</Button>
        <Button variant="destructive" onClick={() => decide.mutate({ id, state: KycState.Rejected })} disabled={decide.isPending}>Reject</Button>
      </div>
    </div>
  )
}
