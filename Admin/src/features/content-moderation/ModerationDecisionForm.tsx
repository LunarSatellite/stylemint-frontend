import { useModerationDecide } from '@/api/mutations/useModerationDecide'
import { showErrorToast } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function ModerationDecisionForm({ id }: { id: string }) {
  const decide = useModerationDecide({ onSuccess: () => toast.success('Decision saved'), onError: showErrorToast })
  return (
    <div className="bg-bg-card border border-[var(--surface-border)] rounded-lg p-6 space-y-4">
      <h2 className="text-text-primary font-medium">Decision</h2>
      <div className="flex gap-3">
        <Button className="bg-primary hover:bg-primary-dark text-bg-primary" onClick={() => decide.mutate({ id, state: 2 })} disabled={decide.isPending}>Approve</Button>
        <Button variant="destructive" onClick={() => decide.mutate({ id, state: 3 })} disabled={decide.isPending}>Remove</Button>
      </div>
    </div>
  )
}
