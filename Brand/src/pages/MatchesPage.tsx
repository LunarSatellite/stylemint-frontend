import { UserCheck } from 'lucide-react'

export default function MatchesPage() {
  return <ComingSoon icon={UserCheck} title="Matches" description="Discover and invite creators matched to your brand and briefs." />
}

function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)' }}
      >
        <Icon className="h-7 w-7 text-[var(--text-muted)]" aria-hidden="true" />
      </div>
      <div className="text-center">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h1>
        <p className="mt-1 max-w-xs text-sm text-[var(--text-muted)]">{description}</p>
      </div>
      <span
        className="rounded-full px-3 py-1 text-xs font-medium"
        style={{ background: 'var(--surface-3)', color: 'var(--text-muted)' }}
      >
        Coming soon
      </span>
    </div>
  )
}
