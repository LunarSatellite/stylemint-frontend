import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** A tab kept in the URL (`?tab=`), so a refresh or a shared link opens the same tab. */
export function useTab<T extends string>(allowed: readonly T[], fallback: T): [T, (next: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab = (allowed as readonly string[]).includes(raw ?? '') ? (raw as T) : fallback;
  const set = useCallback(
    (next: string | null) => {
      setParams(
        (p) => {
          const copy = new URLSearchParams(p);
          if (!next || next === fallback) copy.delete('tab');
          else copy.set('tab', next);
          return copy;
        },
        { replace: true },
      );
    },
    [setParams, fallback],
  );
  return [tab, set];
}
