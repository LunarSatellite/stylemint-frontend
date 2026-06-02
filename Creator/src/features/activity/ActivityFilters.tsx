import { CreatorActivityKind } from '@/lib/enums'
import { Button } from '@/components/ui/button'

interface ActivityFiltersProps {
  selected: number[]
  onChange: (kinds: number[]) => void
}

const filterOptions: { label: string; value: number }[] = [
  { label: 'Earnings',    value: CreatorActivityKind.Earnings },
  { label: 'Reels',      value: CreatorActivityKind.ReelPublished },
  { label: 'Partnerships', value: CreatorActivityKind.PartnershipAccepted },
  { label: 'Payouts',    value: CreatorActivityKind.PayoutCompleted },
]

export function ActivityFilters({ selected, onChange }: ActivityFiltersProps) {
  function toggle(value: number) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    )
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter activity">
      {filterOptions.map((opt) => (
        <Button
          key={opt.value}
          variant={selected.includes(opt.value) ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => toggle(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  )
}
