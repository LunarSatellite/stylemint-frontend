import { useStoryArcList } from '@/api/queries/useStoryArcList'

export function StoryArcList() {
  const { data, isLoading, isError, refetch } = useStoryArcList()

  if (isLoading) return <StoryArcListSkeleton />
  if (isError)   return <p className="text-text-muted">Failed to load story arcs. <button onClick={() => void refetch()} className="text-primary underline">Retry</button></p>

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-text-primary">Story Arcs</h1>
      {data?.length === 0 && <p className="text-text-muted">No story arcs yet.</p>}
      <ul className="space-y-3">
        {data?.map((arc) => (
          <li key={arc.id} className="rounded-xl bg-bg-card p-4">
            <p className="font-medium text-text-primary">{arc.title}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StoryArcListSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3].map((n) => <div key={n} className="h-16 rounded-xl bg-bg-card" />)}
    </div>
  )
}
