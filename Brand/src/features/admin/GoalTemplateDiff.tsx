import { cn } from '@/lib/cn'
import type { GoalTemplateVersionDto } from '@/api/schema'

interface GoalTemplateDiffProps {
  previous: GoalTemplateVersionDto
  current:  GoalTemplateVersionDto
  className?: string
}

export function GoalTemplateDiff({ previous, current, className }: GoalTemplateDiffProps) {
  const prevLines = (previous.promptText ?? '').split('\n')
  const currLines = (current.promptText  ?? '').split('\n')

  return (
    <div className={cn('rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden', className)}>
      <div className="grid grid-cols-2 divide-x divide-[var(--border-subtle)]">
        <DiffPanel label={`v${previous.version} (superseded)`} lines={prevLines} variant="removed" />
        <DiffPanel label={`v${current.version} (active)`}      lines={currLines} variant="added"   />
      </div>
    </div>
  )
}

function DiffPanel({ label, lines, variant }: {
  label:   string
  lines:   string[]
  variant: 'added' | 'removed'
}) {
  return (
    <div>
      <div className="border-b border-[var(--border-subtle)] px-4 py-2">
        <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              'px-1 rounded',
              variant === 'added'   && 'text-emerald-300',
              variant === 'removed' && 'text-[var(--text-muted)]',
            )}
          >
            {line || ' '}
          </div>
        ))}
      </pre>
    </div>
  )
}
