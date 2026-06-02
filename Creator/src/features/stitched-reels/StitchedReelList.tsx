import { useStitchedReelSuggestions } from '@/api/queries/useStitchedReelSuggestions'

interface StitchedReelListProps {
  reelId: string
}

export function StitchedReelList({ reelId }: StitchedReelListProps) {
  const { data, isLoading } = useStitchedReelSuggestions(reelId)

  if (isLoading) return <div className="animate-pulse h-24 rounded-xl bg-bg-card" />
  if (!data?.length) return null

  return (
    <div className="space-y-3">
      {data.map((s) => (
        <div key={s.id} className="rounded-xl bg-bg-card p-4">
          <img
            src={s.candidateReelThumbnailUrl ?? '/placeholder-reel.png'}
            alt=""
            className="h-20 w-full rounded-lg object-cover"
          />
          <p className="mt-2 text-sm text-text-secondary">
            {s.candidateCreatorDisplayName ?? 'Creator unavailable'}
          </p>
        </div>
      ))}
    </div>
  )
}
