import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Join class names, with later Tailwind utilities winning over earlier. */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
