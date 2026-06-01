import { useState } from 'react'
import { useAuditLog } from '@/api/queries/useAuditLog'
import { useDebounce } from '@/hooks/use-debounce'
import { AuditLogView } from './AuditLogView'

export function AuditLogContainer() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useAuditLog({ search: debouncedSearch })
  const entries = data?.pages.flatMap((p: any) => p.items) ?? []
  return <AuditLogView entries={entries} isLoading={isLoading} hasNextPage={!!hasNextPage} isFetchingNextPage={isFetchingNextPage} search={search} onSearchChange={setSearch} onFetchMore={fetchNextPage} />
}
