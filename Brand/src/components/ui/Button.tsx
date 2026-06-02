import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive'
type Size    = 'sm' | 'md' | 'lg'

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: Variant
  size?:    Size
  loading?: boolean
}

const variantStyles: Record<Variant, string> = {
  primary:     'bg-[var(--primary)] text-[var(--bg-primary)] hover:bg-[var(--primary-dark)]',
  secondary:   'border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--surface-2)]',
  ghost:       'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
}

const sizeStyles: Record<Size, string> = {
  sm: 'h-7 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-6 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled ?? loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium',
        'transition-colors focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[var(--bg-primary)] disabled:opacity-50',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {loading ? 'Loading…' : children}
    </button>
  ),
)
Button.displayName = 'Button'
