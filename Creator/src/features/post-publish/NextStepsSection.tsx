import type { NextStep } from '@/api/schema'

interface NextStepsSectionProps {
  steps: NextStep[]
}

export function NextStepsSection({ steps }: NextStepsSectionProps) {
  return (
    <div className="rounded-xl bg-bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">What's Next</h3>
      <ul className="space-y-3">
        {steps.map((s, i) => (
          <li key={i}>
            <p className="text-sm font-medium text-text-primary">{s.title}</p>
            <p className="text-xs text-text-muted">{s.description}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
