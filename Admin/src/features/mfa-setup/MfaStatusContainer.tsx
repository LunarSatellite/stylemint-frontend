import { useMeMfa } from '@/api/queries/useMeMfa'
import { useMfaRemove } from '@/api/mutations/useMfaRemove'
import { showErrorToast } from '@/api/errors'
import { toast } from 'sonner'
import { MfaStatusView } from './MfaStatusView'
import { MfaEnrollFlow } from './MfaEnrollFlow'

export function MfaStatusContainer() {
  const { data: status, isLoading } = useMeMfa()

  const remove = useMfaRemove({
    onSuccess: () => toast.success('Authenticator removed'),
    onError:   showErrorToast,
  })

  if (isLoading) return (
    <div className="flex flex-col gap-4 max-w-lg w-full">
      {[80, 160, 120].map((h, i) => (
        <div key={i} className="rounded-[14px] border border-white/[0.07] bg-white/[0.02]" style={{ height: h }} />
      ))}
    </div>
  )

  if (status?.hasTotp && status?.totpConfirmed) {
    return (
      <MfaStatusView
        status={status}
        onRemove={() => remove.mutate(undefined)}
        isRemoving={remove.isPending}
      />
    )
  }

  return <MfaEnrollFlow />
}
