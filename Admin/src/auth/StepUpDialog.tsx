import { create } from 'zustand'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMfaVerify } from '@/api/mutations/useMfaVerify'
import { showErrorToast } from '@/api/errors'

interface StepUpState {
  isOpen: boolean
  resolve: (() => void) | null
  reject: ((err: unknown) => void) | null
  open: () => Promise<void>
  close: () => void
}

export const useStepUpDialog = create<StepUpState>((set, get) => ({
  isOpen: false,
  resolve: null,
  reject: null,
  open: () =>
    new Promise((resolve, reject) => {
      set({ isOpen: true, resolve: resolve, reject })
    }),
  close: () => {
    get().reject?.(new Error('Step-up cancelled'))
    set({ isOpen: false, resolve: null, reject: null })
  },
}))

export function StepUpDialog() {
  const { isOpen, resolve, close } = useStepUpDialog()
  const [code, setCode] = useState('')
  const verify = useMfaVerify({
    onSuccess: () => { resolve?.(); useStepUpDialog.setState({ isOpen: false }) },
    onError: showErrorToast,
  })

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="bg-bg-elevated border-[var(--surface-border)] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-text-primary">Verify your identity</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            maxLength={6}
            className="bg-bg-primary border-[var(--border-primary)] text-text-primary text-center text-lg tracking-widest"
          />
          <Button
            className="w-full bg-primary hover:bg-primary-dark text-bg-primary"
            onClick={() => verify.mutate({ code })}
            disabled={code.length !== 6 || verify.isPending}
          >
            {verify.isPending ? 'Verifying…' : 'Confirm'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
