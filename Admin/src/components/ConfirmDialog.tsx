import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface ConfirmDialogProps {
  title: string
  description: string
  onConfirm: () => void
  trigger: React.ReactNode
  confirmLabel?: string
  isPending?: boolean
}

export function ConfirmDialog({
  title,
  description,
  onConfirm,
  trigger,
  confirmLabel = 'Confirm',
  isPending,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-bg-elevated border-[var(--surface-border)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-text-primary">{title}</DialogTitle>
            <DialogDescription className="text-text-muted">{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-text-muted">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => { onConfirm(); setOpen(false) }}
              disabled={isPending}
            >
              {isPending ? 'Processing…' : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
