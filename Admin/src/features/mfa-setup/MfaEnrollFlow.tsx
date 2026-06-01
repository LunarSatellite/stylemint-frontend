import { useState } from 'react'
import { useMfaEnroll } from '@/api/mutations/useMfaEnroll'
import { useMfaConfirm } from '@/api/mutations/useMfaConfirm'
import { showErrorToast } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MfaQrCode } from './MfaQrCode'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

type Step = 'start' | 'scan' | 'confirm'

export function MfaEnrollFlow() {
  const [step, setStep] = useState<Step>('start')
  const [qrUri, setQrUri] = useState('')
  const [code, setCode] = useState('')
  const navigate = useNavigate()

  const enroll = useMfaEnroll({ onSuccess: ({ qrCodeUri }) => { setQrUri(qrCodeUri); setStep('scan') }, onError: showErrorToast })
  const confirm = useMfaConfirm({ onSuccess: () => { toast.success('MFA enabled'); navigate('/kyc') }, onError: showErrorToast })

  return (
    <div className="bg-bg-card border border-[var(--surface-border)] rounded-xl p-8 w-full max-w-sm space-y-6">
      <h1 className="text-xl font-semibold text-text-primary">Set up MFA</h1>
      {step === 'start' && <Button className="w-full bg-primary hover:bg-primary-dark text-bg-primary" onClick={() => enroll.mutate()} disabled={enroll.isPending}>Get Started</Button>}
      {step === 'scan' && (
        <div className="space-y-4">
          <MfaQrCode uri={qrUri} />
          <p className="text-text-muted text-sm">Scan with your authenticator app, then enter the 6-digit code.</p>
          <Button className="w-full bg-primary hover:bg-primary-dark text-bg-primary" onClick={() => setStep('confirm')}>Next</Button>
        </div>
      )}
      {step === 'confirm' && (
        <div className="space-y-4">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" maxLength={6} className="bg-bg-elevated border-[var(--border-primary)] text-text-primary text-center text-lg tracking-widest" />
          <Button className="w-full bg-primary hover:bg-primary-dark text-bg-primary" onClick={() => confirm.mutate({ code })} disabled={code.length !== 6 || confirm.isPending}>{confirm.isPending ? 'Verifying…' : 'Activate'}</Button>
        </div>
      )}
    </div>
  )
}
