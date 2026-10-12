import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';
import { correlationIdOf, errorCodeOf, getErrorMessage } from '../errors';
import { recipeKeys } from '../queries/useRecipeDrafts';

function useRecipeWrite<TVars>(
  request: (vars: TVars) => Promise<unknown>,
  success: (vars: TVars) => string,
) {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, TVars>({
    mutationFn: request,
    onSuccess: (_d, vars) => toast.success(success(vars)),
    onError: (err) => {
      const correlationId = correlationIdOf(err);
      toast.error(getErrorMessage(errorCodeOf(err)), {
        description: correlationId ? `Ref: ${correlationId}` : undefined,
        duration: 8000,
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: recipeKeys.all() });
    },
  });
}

export interface RecipeVars {
  id: string;
  title: string;
}
export interface HideRecipeVars extends RecipeVars {
  reason: string;
}

/** Promote takes no body: approval is the act, not a payload. */
export function usePromoteRecipe() {
  return useRecipeWrite<RecipeVars>(
    (v) => api.post(`/v1/admin/recipes/${v.id}/promote-to-curated`),
    (v) => `"${v.title}" is now platform curated.`,
  );
}

export function useHideRecipe() {
  return useRecipeWrite<HideRecipeVars>(
    (v) => api.post(`/v1/admin/recipes/${v.id}/hide`, { reason: v.reason }),
    (v) => `"${v.title}" is hidden.`,
  );
}
