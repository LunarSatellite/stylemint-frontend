import { formatPercent } from '@/lib/formatters'

interface FunnelStep {
  label: string
  value: number
}

interface ConversionFunnelProps {
  steps: FunnelStep[]
}

export function ConversionFunnel({ steps }: ConversionFunnelProps) {
  return (
    <div className="rounded-xl bg-bg-card p-4">
      <h3 className="mb-4 text-sm font-medium text-text-secondary">Conversion Funnel</h3>
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-text-muted">{step.label}</span>
              <span className="text-text-secondary">{formatPercent(step.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${step.value * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
