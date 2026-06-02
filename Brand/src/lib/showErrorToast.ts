import { toast } from 'sonner'
import { errorMessages } from './errorMessages'

export function showErrorToast(errorCode: string, correlationId: string | null) {
  const message = errorMessages[errorCode] ?? errorMessages['system.internal_error']
  toast.error(message, {
    description: correlationId ? `ID: ${correlationId}` : undefined,
  })
}
