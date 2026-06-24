import { useState } from 'react'
import { useAuditLog } from '@/api/queries/useAuditLog'
import { useMe } from '@/api/queries/useMe'
import { useDebounce } from '@/hooks/use-debounce'
import { AuditLogView } from './AuditLogView'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function AuditLogContainer() {
  const [action,         setAction]         = useState('')
  const [adminAccountId, setAdminAccountId] = useState('')
  const [targetKind,     setTargetKind]     = useState('')
  const [targetId,       setTargetId]       = useState('')
  const [fromDate,       setFromDate]       = useState('')
  const [toDate,         setToDate]         = useState('')

  const debouncedAction   = useDebounce(action)
  const debouncedAdminId  = useDebounce(adminAccountId)
  const debouncedKind     = useDebounce(targetKind)
  const debouncedTargetId = useDebounce(targetId)

  const adminIdValid = !debouncedAdminId || UUID_RE.test(debouncedAdminId)

  const meQ = useMe()

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, isError } = useAuditLog({
    action:         debouncedAction                            || undefined,
    adminAccountId: UUID_RE.test(debouncedAdminId) ? debouncedAdminId : undefined,
    targetKind:     debouncedKind                              || undefined,
    targetId:       debouncedTargetId                          || undefined,
    fromUtc:        fromDate ? `${fromDate}T00:00:00.000Z`     : undefined,
    toUtc:          toDate   ? `${toDate}T23:59:59.999Z`       : undefined,
  })

  const entries = data?.pages.flatMap((p: any) => p.items ?? []) ?? []

  const hasActiveFilters = !!(action || adminAccountId || targetKind || targetId || fromDate || toDate)

  function clearFilters() {
    setAction('')
    setAdminAccountId('')
    setTargetKind('')
    setTargetId('')
    setFromDate('')
    setToDate('')
  }

  if (isError) return <div className="text-red-400">Failed to load audit log.</div>

  return (
    <AuditLogView
      entries={entries}
      isLoading={isLoading}
      hasNextPage={!!hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      actionFilter={action}
      adminAccountIdFilter={adminAccountId}
      targetKindFilter={targetKind}
      targetIdFilter={targetId}
      fromDateFilter={fromDate}
      toDateFilter={toDate}
      hasActiveFilters={hasActiveFilters}
      adminIdValid={adminIdValid}
      meId={meQ.data?.id}
      meName={meQ.data?.displayName ?? meQ.data?.email ?? undefined}
      onActionChange={setAction}
      onAdminAccountIdChange={setAdminAccountId}
      onTargetKindChange={setTargetKind}
      onTargetIdChange={setTargetId}
      onFromDateChange={setFromDate}
      onToDateChange={setToDate}
      onClearFilters={clearFilters}
      onFetchMore={fetchNextPage}
    />
  )
}
