import { useParams } from 'react-router-dom'
import { useStoryArcDetail } from '@/api/queries/useStoryArcDetail'

export function StoryArcDetail() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, isError, refetch } = useStoryArcDetail(id!)

  if (isLoading) return <div className="animate-pulse h-64 rounded-xl bg-bg-card" />
  if (isError)   return <p className="text-text-muted">Failed to load. <button onClick={() => void refetch()} className="text-primary underline">Retry</button></p>
  if (!data)     return null

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-text-primary">{data.title}</h1>
      <p className="text-text-secondary">{data.description}</p>
    </div>
  )
}
