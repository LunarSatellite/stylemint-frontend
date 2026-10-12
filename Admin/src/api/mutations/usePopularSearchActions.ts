import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';
import { correlationIdOf, errorCodeOf, getErrorMessage } from '../errors';
import { catalogKeys } from '../queries/usePopularSearches';

function useCatalogWrite<TVars>(
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
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all() });
    },
  });
}

export interface ToggleSearchVars {
  id: string;
  label: string;
}

export function useActivateSearch() {
  return useCatalogWrite<ToggleSearchVars>(
    (v) => api.post(`/v1/admin/catalog/popular-searches/${v.id}/activate`),
    (v) => `"${v.label}" is now suggested to shoppers.`,
  );
}

export function useDeactivateSearch() {
  return useCatalogWrite<ToggleSearchVars>(
    (v) => api.post(`/v1/admin/catalog/popular-searches/${v.id}/deactivate`),
    (v) => `"${v.label}" is no longer suggested.`,
  );
}
