import type { ReactNode } from 'react'
import { ShieldCheck, AlertTriangle } from 'lucide-react'
import type { AdminMfaStatusDto } from '@/api/schema'
import { formatDate } from '@/lib/formatters'
import { Button } from '@/components/ui/button'

interface Props {
  status:     AdminMfaStatusDto
  onRemove:   () => void
  isRemoving: boolean
}

const cardCls = 'rounded-[14px] border border-white/[0.07] bg-bg-card p-6'

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#4A7A6A]">{label}</span>
      <span className="text-[13px] text-text-secondary">{value}</span>
    </div>
  )
}

export function MfaStatusView({ status, onRemove, isRemoving }: Props) {
  const maxMin    = status.stepUpMaxAgeMinutes ?? 5
  const lastStepUp = status.sessionLastStepUpUtc
  const remainingMin = status.sessionStepUpFresh && lastStepUp
    ? Math.max(0, Math.round(maxMin - (Date.now() - new Date(lastStepUp).getTime()) / 60_000))
    : 0

  return (
    <div className="flex flex-col gap-4 max-w-lg w-full">

      {/* Active badge */}
      <div className={`${cardCls} flex items-center gap-3`}>
        <ShieldCheck size={22} className="shrink-0 text-primary" />
        <div>
          <p className="m-0 text-[14px] font-bold text-text-primary">TOTP Active</p>
          <p className="m-0 text-[12px] text-text-muted">Authenticator app enrolled and confirmed</p>
        </div>
      </div>

      {/* Lockout warning */}
      {status.totpLocked && (
        <div className="flex items-center gap-2 rounded-[12px] border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-[13px] text-red-400">
          <AlertTriangle size={14} className="shrink-0" />
          TOTP locked — too many failed attempts. A SuperAdmin can unlock via your admin account page.
        </div>
      )}

      {/* Step-up status */}
      <div className={`${cardCls} flex flex-col gap-4`}>
        <h2 className="m-0 text-[14px] font-bold text-text-primary">Step-up Status</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Step-up fresh"
            value={
              status.sessionStepUpFresh
                ? <span className="font-semibold text-primary">{remainingMin} min remaining</span>
                : <span className="text-text-muted">No active step-up</span>
            }
          />
          <Field
            label="Valid window"
            value={`${maxMin} minutes`}
          />
          <Field
            label="Last step-up"
            value={lastStepUp ? formatDate(lastStepUp) : '—'}
          />
          <Field
            label="Last verified"
            value={status.totpLastVerifiedUtc ? formatDate(status.totpLastVerifiedUtc) : '—'}
          />
        </div>
      </div>

      {/* Remove */}
      <div className={cardCls}>
        <h2 className="m-0 mb-2 text-[14px] font-bold text-text-primary">Remove Authenticator</h2>
        <p className="m-0 mb-4 text-[13px] text-text-muted">
          Removing your authenticator requires step-up. You will need to re-enroll before
          step-up gated actions become available again.
        </p>
        <Button
          variant="outline"
          disabled={isRemoving}
          onClick={onRemove}
          className="border-red-400/30 text-red-400 hover:bg-red-400/[0.08]"
        >
          {isRemoving ? 'Removing…' : 'Remove authenticator'}
        </Button>
      </div>
    </div>
  )
}
