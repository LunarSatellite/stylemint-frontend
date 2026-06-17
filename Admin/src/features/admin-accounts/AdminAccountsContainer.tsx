import { useState } from 'react'
import { useAdminAccounts } from '@/api/queries/useAdminAccounts'
import { useDebounce } from '@/hooks/use-debounce'
import { AdminAccountsView } from './AdminAccountsView'

export function AdminAccountsContainer() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const { data, isLoading, isError } = useAdminAccounts({ page, pageSize: 20, search: debouncedSearch })
  if (isError) return <div className="text-red-400">Failed to load admins.</div>
  return <AdminAccountsView data={data?.items ?? []} total={data?.totalCount ?? 0} page={page} pageSize={20} search={search} isLoading={isLoading} onPageChange={setPage} onSearchChange={setSearch} />
}
