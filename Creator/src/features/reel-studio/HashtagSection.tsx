interface HashtagSectionProps {
  hashtags: string[]
}

export function HashtagSection({ hashtags }: HashtagSectionProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {hashtags.map((tag) => (
        <span key={tag} className="rounded-full bg-surface-2 px-3 py-1 text-xs text-text-secondary">
          #{tag}
        </span>
      ))}
    </div>
  )
}
