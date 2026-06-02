import type { CaptionVariant } from '@/api/schema'

interface CaptionVariantsProps {
  variants: CaptionVariant[]
}

export function CaptionVariants({ variants }: CaptionVariantsProps) {
  return (
    <div className="space-y-3">
      {variants.map((v, i) => (
        <div key={i} className="rounded-xl bg-bg-card p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{v.tone}</span>
          <p className="mt-2 text-sm text-text-primary">{v.text}</p>
        </div>
      ))}
    </div>
  )
}
