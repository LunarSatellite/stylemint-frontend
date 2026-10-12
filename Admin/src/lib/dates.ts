import { format, parseISO } from 'date-fns';

/**
 * A date the server sent, for a human.
 *
 * Returns the raw string rather than throwing or blanking when it
 * cannot parse: a malformed timestamp should make one cell look odd,
 * not empty the row or take down the table.
 */
export function utcDate(value: string | null | undefined, pattern = 'd MMM yyyy, HH:mm'): string {
  if (!value) return '—';
  try {
    return format(parseISO(value), pattern);
  } catch {
    return value;
  }
}
