import axios from 'axios'

export interface ApiError {
  errorCode:         string
  correlationId:     string | null
  retryAfterSeconds?: number
}

export function extractApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | undefined
    return {
      errorCode:         (data?.['errorCode'] as string)        ?? 'system.internal_error',
      correlationId:     (data?.['correlationId'] as string)    ?? null,
      retryAfterSeconds: (data?.['retryAfterSeconds'] as number) ?? undefined,
    }
  }
  return { errorCode: 'system.internal_error', correlationId: null }
}
