import { useState } from 'react'
import { usePayouts } from '@/api/queries/usePayouts'
import { useDebounce } from '@/hooks/use-debounce'
import { PayoutsView } from './PayoutsView'

export function PayoutsContainer() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const { data, isLoading, isError } = usePayouts({ page, pageSize: 20, search: debouncedSearch })
  if (isError) return <div className="text-red-400">Failed to load payouts.</div>
  return <PayoutsView data={data?.items ?? []} total={data?.total ?? 0} page={page} pageSize={20} search={search} isLoading={isLoading} onPageChange={setPage} onSearchChange={setSearch} />
}
