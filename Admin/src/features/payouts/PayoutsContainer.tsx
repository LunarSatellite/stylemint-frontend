import { useState } from 'react'
import { usePayouts } from '@/api/queries/usePayouts'
import { PayoutsView } from './PayoutsView'

export function PayoutsContainer() {
  const [cursor, setCursor]           = useState<string | undefined>(undefined)
  const [cursorStack, setCursorStack] = useState<string[]>([])

  const { data, isLoading, isError } = usePayouts({ cursor, pageSize: 20 })

  function handleNext() {
    if (!data?.nextCursor) return
    setCursorStack((prev) => [...prev, cursor ?? ''])
    setCursor(data.nextCursor)
  }

  function handlePrev() {
    if (!cursorStack.length) return
    const stack = [...cursorStack]
    const prev  = stack.pop()
    setCursorStack(stack)
    setCursor(prev || undefined)
  }

  if (isError) return <div className="text-red-400">Failed to load payouts.</div>

  return (
    <PayoutsView
      data={data?.items ?? []}
      isLoading={isLoading}
      hasNext={data?.hasMore ?? false}
      hasPrev={cursorStack.length > 0}
      onNext={handleNext}
      onPrev={handlePrev}
    />
  )
}
