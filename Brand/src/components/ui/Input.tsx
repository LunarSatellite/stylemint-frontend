import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends ComponentPropsWithoutRef<'input'> {
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      <input
        ref={ref}
        className={cn(
          'h-9 w-full rounded-md border bg-[var(--surface-2)] px-3 text-sm',
          'border-[var(--border-subtle)] text-[var(--text-primary)]',
          'placeholder:text-[var(--text-muted)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]',
          'focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-primary)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-red-500 focus-visible:ring-red-500',
          className,
        )}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error && (
        <span role="alert" className="text-xs text-red-400">{error}</span>
      )}
    </div>
  ),
)
Input.displayName = 'Input'
