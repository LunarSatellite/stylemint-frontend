import { useRecipesTab } from '@/api/queries/useRecipesTab'

export function RecipesTab() {
  const { data, isLoading, isError, refetch } = useRecipesTab()

  if (isLoading) return <div className="animate-pulse h-64 rounded-xl bg-bg-card" />
  if (isError)   return <p className="text-text-muted">Failed to load recipes. <button onClick={() => void refetch()} className="text-primary underline">Retry</button></p>
  if (!data)     return null

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-text-primary">Recipes</h1>
      <p className="text-text-muted text-sm">{data.all.length} recipes available</p>
    </div>
  )
}
