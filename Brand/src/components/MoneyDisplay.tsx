import { formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/cn'

interface MoneyDisplayProps {
  amount:    number
  currency:  string
  className?: string
}

export function MoneyDisplay({ amount, currency, className }: MoneyDisplayProps) {
  return (
    <span className={cn('tabular-nums', className)}>
      {formatMoney(amount, currency)}
    </span>
  )
}
