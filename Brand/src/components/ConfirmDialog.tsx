import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { cn } from '@/lib/cn'

interface ConfirmDialogProps {
  open:        boolean
  onOpenChange: (open: boolean) => void
  title:       string
  description: string
  confirmLabel?: string
  destructive?:  boolean
  onConfirm:   () => void
  isLoading?:  boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        <AlertDialog.Content className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-md rounded-xl border p-6',
          'border-[var(--border-subtle)] bg-[var(--bg-elevated)]',
          'shadow-[var(--shadow-soft)]',
        )}>
          <AlertDialog.Title className="text-base font-semibold text-[var(--text-primary)]">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-[var(--text-muted)]">
            {description}
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <button className={cn(
                'rounded-md px-4 py-2 text-sm font-medium',
                'border border-[var(--border-subtle)] text-[var(--text-secondary)]',
                'hover:bg-[var(--surface-2)]',
              )}>
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={cn(
                  'rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50',
                  destructive
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-[var(--primary)] text-[var(--bg-primary)] hover:bg-[var(--primary-dark)]',
                )}
              >
                {isLoading ? 'Loading…' : confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
