import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useKycApprove, useKycReject } from '@/api/mutations/useKycDecide'
import { showErrorToast } from '@/api/errors'

const inputCls =
  'w-full bg-bg-elevated border border-[var(--border-subtle)] rounded-lg py-[9px] px-3 text-[13px] text-text-primary outline-none transition-colors duration-[180ms] focus:border-[var(--border-primary)]'

export function KycDecisionForm({
  applicationId,
  kind,
  onDecided,
}: {
  applicationId: string
  kind: 'creator' | 'vendor'
  onDecided?: () => void
}) {
  const [selected, setSelected] = useState<'approve' | 'reject' | null>(null)
  const [reason, setReason] = useState('')

  const approve = useKycApprove({
    onSuccess: () => { toast.success('Application approved.'); onDecided?.() },
    onError:   showErrorToast,
  })
  const reject = useKycReject({
    onSuccess: () => { toast.success('Application rejected.'); onDecided?.() },
    onError:   showErrorToast,
  })

  const isPending = approve.isPending || reject.isPending

  function handleSubmit() {
    if (selected === 'approve') {
      approve.mutate({ applicationId, kind })
    } else if (selected === 'reject') {
      reject.mutate({ applicationId, kind, reason: reason || null })
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-[14px] border border-white/[0.07] bg-bg-card p-6">
      <h2 className="m-0 text-[14px] font-bold text-text-primary">Make a Decision</h2>

      {/* Decision selector */}
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-text-muted">Decision</span>
        <div className="flex flex-col gap-1.5">
          {([
            { value: 'approve' as const, label: 'Approve', color: '#00D98A' },
            { value: 'reject'  as const, label: 'Reject',  color: '#f87171' },
          ]).map(opt => {
            const active = selected === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelected(opt.value)}
                className="flex cursor-pointer items-center gap-[10px] rounded-[9px] px-[14px] py-[10px] text-left transition-all duration-[150ms]"
                style={{
                  border:     active ? `1.5px solid ${opt.color}40` : '1px solid rgba(255,255,255,0.07)',
                  background: active ? `${opt.color}12` : 'rgba(255,255,255,0.02)',
                }}
              >
                <div
                  className="flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full"
                  style={{
                    border:     active ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
                    background: active ? opt.color : 'transparent',
                  }}
                >
                  {active && <div className="h-[5px] w-[5px] rounded-full bg-bg-primary" />}
                </div>
                <span
                  className="text-[13px]"
                  style={{ fontWeight: active ? 600 : 400, color: active ? opt.color : '#B8E6D5' }}
                >
                  {opt.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Reason — only for reject */}
      {selected === 'reject' && (
        <div className="flex flex-col gap-[7px]">
          <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Reason{' '}
            <span className="font-normal normal-case tracking-normal text-[#4A7A6A]">(optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Explain why this application is being rejected…"
            className={`${inputCls} resize-y leading-relaxed`}
          />
        </div>
      )}

      <button
        type="button"
        disabled={!selected || isPending}
        onClick={handleSubmit}
        className={`flex items-center justify-center gap-[7px] rounded-[10px] border-none py-3 text-[14px] font-bold transition-all duration-[180ms] ${
          !selected || isPending
            ? 'cursor-not-allowed bg-bg-elevated text-[#4A7A6A]'
            : 'cursor-pointer bg-primary text-bg-primary hover:bg-primary-dark'
        }`}
      >
        {isPending && <Loader2 size={14} className="animate-spin" />}
        {isPending ? 'Submitting…' : 'Submit Decision'}
      </button>
    </div>
  )
}
