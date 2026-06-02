import { useState } from 'react'
import { useGoalTemplates } from '@/api/queries/useGoalTemplates'
import { CampaignGoal } from '@/lib/enums'
import type { ValueOf } from '@/lib/types'
import type { CampaignGoal as CampaignGoalType } from '@/api/schema'

const goalLabels: Record<ValueOf<typeof CampaignGoal>, string> = {
  1: 'Drive First Purchase',
  2: 'Reintroduce Dormant',
  3: 'Launch New Variant',
  4: 'Clear Slow Inventory',
  5: 'Build Seasonal Awareness',
  6: 'Educate On Use',
  7: 'Test New Audience',
}

export function GoalTemplateManager() {
  const [selectedGoal, setSelectedGoal] = useState<CampaignGoalType>(CampaignGoal.DriveFirstPurchase)
  const { data: templates, isPending, isError } = useGoalTemplates(selectedGoal)

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="mb-6 text-xl font-semibold text-[var(--text-primary)]">Goal Templates</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.entries(goalLabels) as [string, string][]).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setSelectedGoal(Number(value) as CampaignGoalType)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedGoal === Number(value)
                ? 'bg-[var(--primary)] text-[var(--bg-primary)]'
                : 'border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isPending && <div className="text-sm text-[var(--text-muted)] animate-pulse">Loading templates…</div>}
      {isError   && <div className="text-sm text-[var(--text-muted)]">Failed to load templates.</div>}

      {templates && templates.map((t) => (
        <div key={t.id} className="mb-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--text-primary)]">v{t.version}</span>
            <span className="text-xs text-[var(--text-muted)]">{t.state === 1 ? 'Active' : t.state === 2 ? 'Superseded' : 'Retired'}</span>
          </div>
          <p className="mt-2 text-xs text-[var(--text-secondary)] line-clamp-3">{t.promptText}</p>
        </div>
      ))}

      {/* TODO: GoalTemplateDiff, Author/Supersede/Retire actions */}
    </div>
  )
}
