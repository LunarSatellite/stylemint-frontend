import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { errorMessages } from '@/lib/errorMessages'

export function showErrorToast(err: unknown) {
  const errorCode    = isAxiosError(err) ? (err.response?.data as Record<string, string>)?.errorCode : undefined
  const correlationId = isAxiosError(err) ? (err.response?.data as Record<string, string>)?.correlationId : undefined
  const message = (errorCode && errorMessages[errorCode]) ?? 'Something went wrong.'

  toast.error(message, {
    description: correlationId ? `Reference: ${correlationId}` : undefined,
  })
}
