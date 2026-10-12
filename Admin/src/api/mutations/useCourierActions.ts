import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';
import { correlationIdOf, errorCodeOf, getErrorMessage } from '../errors';
import { courierKeys } from '../queries/useCourier';

/**
 * The nine admin operations on a courier.
 *
 * None is on the step-up list, so all use a plain mutation. Bodies are
 * read from the spec: `suspend` takes `{ reason }`, `kyc/complete`
 * takes four fields, `escrow/draw` takes an amount and a package, and
 * the other five take nothing at all.
 */
function useCourierWrite<TVars extends { courierProfileId: string }>(
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
    onSettled: (_d, _e, vars) => {
      void queryClient.invalidateQueries({ queryKey: courierKeys.byId(vars.courierProfileId) });
    },
  });
}

export interface CourierVars {
  courierProfileId: string;
}
export interface SuspendCourierVars extends CourierVars {
  reason: string;
}

const bare = (segment: string, message: string) =>
  function useAction() {
    return useCourierWrite<CourierVars>(
      (v) => api.post(`/v1/admin/couriers/${v.courierProfileId}/${segment}`),
      () => message,
    );
  };

export const usePassBackgroundCheck = bare('background-check-pass', 'Background check recorded as passed.');
export const usePassTraining = bare('training-pass', 'Training recorded as passed.');
export const usePromoteToPro = bare('promote/pro', 'Promoted to Pro.');
export const usePromoteToTraveler = bare('promote/traveler', 'Promoted to Traveler.');
export const useReinstateCourier = bare('reinstate', 'Courier reinstated.');
export const useRecomputeReliability = bare('reliability/recompute', 'Reliability recomputed.');

export function useSuspendCourier() {
  return useCourierWrite<SuspendCourierVars>(
    (v) => api.post(`/v1/admin/couriers/${v.courierProfileId}/suspend`, { reason: v.reason }),
    () => 'Courier suspended. They can take no further deliveries.',
  );
}
