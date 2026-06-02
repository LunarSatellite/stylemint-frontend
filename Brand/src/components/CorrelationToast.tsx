import { toast } from 'sonner'
import { errorMessages } from '@/lib/errorMessages'

export function showCorrelationToast(errorCode: string, correlationId: string | null) {
  const message = errorMessages[errorCode] ?? errorMessages['system.internal_error']
  toast.error(message, {
    description: correlationId ? `Ref: ${correlationId}` : undefined,
    duration: 6000,
  })
}
