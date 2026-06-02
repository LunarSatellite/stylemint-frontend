import type { CommentTheme } from '@/api/schema'

interface CommentThemesSectionProps {
  themes: CommentTheme[]
}

export function CommentThemesSection({ themes }: CommentThemesSectionProps) {
  return (
    <div className="rounded-xl bg-bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">Comment Themes</h3>
      <ul className="space-y-2">
        {themes.map((t) => (
          <li key={t.theme} className="flex items-center justify-between">
            <span className="text-sm text-text-primary">{t.theme}</span>
            <span className="text-xs text-text-muted">{t.count} comments</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
