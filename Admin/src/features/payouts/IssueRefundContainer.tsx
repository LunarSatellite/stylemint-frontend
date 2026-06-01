import { useRefund } from '@/api/mutations/useRefund'
import { showErrorToast } from '@/api/errors'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

const schema = z.object({ orderId: z.string().min(1), amount: z.number().positive(), reason: z.string().min(1) })
type FormValues = z.infer<typeof schema>

export function IssueRefundContainer() {
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })
  const refund = useRefund({ onSuccess: () => { toast.success('Refund issued'); form.reset() }, onError: showErrorToast })
  return (
    <form onSubmit={form.handleSubmit((v) => refund.mutate(v))} className="max-w-md bg-bg-card border border-[var(--surface-border)] rounded-lg p-6 space-y-4">
      <Input {...form.register('orderId')} placeholder="Order ID" className="bg-bg-elevated border-[var(--border-primary)] text-text-primary" />
      <Input {...form.register('amount', { valueAsNumber: true })} type="number" placeholder="Amount (cents)" className="bg-bg-elevated border-[var(--border-primary)] text-text-primary" />
      <Input {...form.register('reason')} placeholder="Reason" className="bg-bg-elevated border-[var(--border-primary)] text-text-primary" />
      <Button type="submit" className="bg-primary hover:bg-primary-dark text-bg-primary w-full" disabled={refund.isPending}>{refund.isPending ? 'Processing…' : 'Issue Refund'}</Button>
    </form>
  )
}
