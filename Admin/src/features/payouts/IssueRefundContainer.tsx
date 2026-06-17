import { useRefund } from '@/api/mutations/useRefund'
import { showErrorToast } from '@/api/errors'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

const schema = z.object({
  paymentIntentId: z.string().min(1, 'Payment Intent ID is required'),
  amount:          z.number({ invalid_type_error: 'Amount is required' }).positive('Must be positive'),
  currency:        z.string().min(3).max(3).toUpperCase(),
  reason:          z.string().min(1, 'Reason is required'),
})
type FormValues = z.infer<typeof schema>

export function IssueRefundContainer() {
  const form   = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { currency: 'USD' } })
  const refund = useRefund({
    onSuccess: () => { toast.success('Refund issued successfully'); form.reset({ currency: 'USD' }) },
    onError:   showErrorToast,
  })

  return (
    <form
      onSubmit={form.handleSubmit((v) => refund.mutate(v))}
      className="max-w-md space-y-4 rounded-lg border border-[var(--surface-border)] bg-bg-card p-6"
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-text-secondary">Payment Intent ID</label>
        <Input
          {...form.register('paymentIntentId')}
          placeholder="pi_…"
          className="bg-bg-elevated border-[var(--border-primary)] text-text-primary font-mono text-sm"
        />
        {form.formState.errors.paymentIntentId && (
          <p className="text-xs text-red-400">{form.formState.errors.paymentIntentId.message}</p>
        )}
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-secondary">Amount</label>
          <Input
            {...form.register('amount', { valueAsNumber: true })}
            type="number"
            step="0.01"
            placeholder="0.00"
            className="bg-bg-elevated border-[var(--border-primary)] text-text-primary"
          />
          {form.formState.errors.amount && (
            <p className="text-xs text-red-400">{form.formState.errors.amount.message}</p>
          )}
        </div>
        <div className="flex w-24 flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-secondary">Currency</label>
          <Input
            {...form.register('currency')}
            placeholder="USD"
            maxLength={3}
            className="bg-bg-elevated border-[var(--border-primary)] text-text-primary uppercase"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-text-secondary">Reason</label>
        <Input
          {...form.register('reason')}
          placeholder="Reason for refund"
          className="bg-bg-elevated border-[var(--border-primary)] text-text-primary"
        />
        {form.formState.errors.reason && (
          <p className="text-xs text-red-400">{form.formState.errors.reason.message}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={refund.isPending}
        className="w-full bg-primary text-bg-primary hover:bg-primary-dark"
      >
        {refund.isPending ? 'Processing…' : 'Issue Refund'}
      </Button>
    </form>
  )
}
