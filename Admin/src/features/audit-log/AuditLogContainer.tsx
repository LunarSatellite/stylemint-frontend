import { useState } from 'react'
import { useAuditLog } from '@/api/queries/useAuditLog'
import { useDebounce } from '@/hooks/use-debounce'
import { AuditLogView } from './AuditLogView'

export function AuditLogContainer() {
  const [action, setAction] = useState('')
  const debouncedAction = useDebounce(action)
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, isError } = useAuditLog({
    action: debouncedAction || undefined,
  })
  const entries = data?.pages.flatMap((p: any) => p.items ?? []) ?? []

  if (isError) return <div className="text-red-400">Failed to load audit log.</div>

  return (
    <AuditLogView
      entries={entries}
      isLoading={isLoading}
      hasNextPage={!!hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      actionFilter={action}
      onActionFilterChange={setAction}
      onFetchMore={fetchNextPage}
    />
  )
}
