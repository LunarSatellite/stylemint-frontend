import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ReelRecipeDto } from '@/api/schema'
import { RecipeCard } from './RecipeCard'

interface RecipeCitationSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipes: ReelRecipeDto[]
  onCite: (recipe: ReelRecipeDto) => void
}

export function RecipeCitationSheet({ open, onOpenChange, recipes, onCite }: RecipeCitationSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto bg-bg-elevated">
        <DialogHeader>
          <DialogTitle className="text-text-primary">Cite a Recipe</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-3">
          {recipes.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              onCite={(recipe) => { onCite(recipe); onOpenChange(false) }}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
