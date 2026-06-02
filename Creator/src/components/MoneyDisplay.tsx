interface MoneyDisplayProps {
  formatted: string
  className?: string
}

export function MoneyDisplay({ formatted, className }: MoneyDisplayProps) {
  return <span className={className}>{formatted}</span>
}
