import type { ReelRecipeDto } from '@/api/schema'
import { formatMs } from '@/lib/formatters'
import { Button } from '@/components/ui/button'

interface RecipeCardProps {
  recipe: ReelRecipeDto
  onCite?: (recipe: ReelRecipeDto) => void
}

export function RecipeCard({ recipe, onCite }: RecipeCardProps) {
  return (
    <div className="rounded-xl bg-bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-text-primary">{recipe.title}</p>
          <p className="mt-0.5 text-xs text-text-muted">{recipe.category} · {formatMs(recipe.estimatedDurationMs)}</p>
        </div>
        {onCite && (
          <Button variant="secondary" size="sm" onClick={() => onCite(recipe)}>
            Use
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm text-text-secondary">{recipe.description}</p>
    </div>
  )
}
