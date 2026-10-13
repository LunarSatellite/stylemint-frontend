import { useMediaQuery } from '@mantine/hooks';

/** Below Mantine's `sm` breakpoint (48em): card lists instead of tables. */
export function useIsPhone(): boolean {
  return useMediaQuery('(max-width: 47.99em)', false, { getInitialValueInEffect: false }) ?? false;
}
