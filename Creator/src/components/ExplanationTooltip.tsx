import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

interface ExplanationTooltipProps {
  explanations: Record<string, string>
  featureKey: string
  children: React.ReactNode
}

export function ExplanationTooltip({ explanations, featureKey, children }: ExplanationTooltipProps) {
  const text = explanations[featureKey]
  if (!text) return <>{children}</>

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help underline decoration-dotted decoration-text-muted underline-offset-2">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}
