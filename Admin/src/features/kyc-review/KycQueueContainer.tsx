import { useState } from 'react'
import { useKycQueue } from '@/api/queries/useKycQueue'
import { showErrorToast } from '@/api/errors'
import { useDebounce } from '@/hooks/use-debounce'
import { KycQueueView } from './KycQueueView'

export function KycQueueContainer() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const { data, isLoading, isError } = useKycQueue({ page, pageSize: 20, search: debouncedSearch })

  if (isError) return <div className="text-red-400 p-4">Failed to load KYC queue.</div>

  return (
    <KycQueueView
      data={data?.items ?? []}
      total={data?.total ?? 0}
      page={page}
      pageSize={20}
      search={search}
      isLoading={isLoading}
      onPageChange={setPage}
      onSearchChange={setSearch}
    />
  )
}
