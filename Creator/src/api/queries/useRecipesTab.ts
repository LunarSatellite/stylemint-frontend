import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import type { RecipesTabPayload } from '@/api/schema'

interface RecipeFilter { productVariantIds?: string[]; categoryIds?: string[] }

export function useRecipesTab(filter: RecipeFilter = {}) {
  return useQuery({
    queryKey: csQk.recipes.tab(filter),
    queryFn: () =>
      api.get<RecipesTabPayload>('/v1/creator/studio/recipes', { params: filter }).then((r) => r.data),
    staleTime: 60_000,
  })
}
