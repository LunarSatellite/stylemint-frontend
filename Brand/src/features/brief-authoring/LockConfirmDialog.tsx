import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useLockBrief } from '@/api/mutations/useLockBrief'
import type { BriefId } from '@/lib/brands'
import type { BrandBriefDto } from '@/api/schema'

interface LockConfirmDialogProps {
  open:        boolean
  onOpenChange: (open: boolean) => void
  brief:       BrandBriefDto & { id: BriefId }
}

export function LockConfirmDialog({ open, onOpenChange, brief }: LockConfirmDialogProps) {
  const lockBrief = useLockBrief()

  function handleConfirm() {
    if (!brief.rowVersion) return
    lockBrief.mutate(
      { id: brief.id, rowVersion: brief.rowVersion },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Lock this brief?"
      description="Once locked, creators will be able to see this brief. You can still fork it to create a new version."
      confirmLabel="Lock Brief"
      onConfirm={handleConfirm}
      isLoading={lockBrief.isPending}
    />
  )
}
