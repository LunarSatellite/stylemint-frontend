import { useState } from 'react'
import { useModerationQueue } from '@/api/queries/useModerationQueue'
import { useDebounce } from '@/hooks/use-debounce'
import { ModerationQueueView } from './ModerationQueueView'

export function ModerationQueueContainer() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const { data, isLoading, isError } = useModerationQueue({ page, pageSize: 20, search: debouncedSearch })
  if (isError) return <div className="text-red-400 p-4">Failed to load moderation queue.</div>
  return <ModerationQueueView data={data?.items ?? []} total={data?.total ?? 0} page={page} pageSize={20} search={search} isLoading={isLoading} onPageChange={setPage} onSearchChange={setSearch} />
}
