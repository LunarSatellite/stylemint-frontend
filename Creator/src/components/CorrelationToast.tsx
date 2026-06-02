import { toast } from 'sonner'

interface CorrelationToastOptions {
  message: string
  correlationId?: string
}

export function showCorrelationToast({ message, correlationId }: CorrelationToastOptions) {
  toast.error(message, {
    description: correlationId ? `Reference: ${correlationId}` : undefined,
  })
}
