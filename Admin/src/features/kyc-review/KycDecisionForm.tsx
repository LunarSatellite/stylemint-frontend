import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useKycDecide } from '@/api/mutations/useKycDecide'
import { showErrorToast } from '@/api/errors'
import { KycDecision, KycRetryableReasonCodes, KycTerminalReasonCodes } from '@/lib/enums'
import { KycReasonCodeLabel } from '@/lib/formatters'

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  decision:           z.number().int().min(1).max(3),
  decisionReasonCode: z.string().nullable().optional(),
  decisionNote:       z.string().max(1000).nullable().optional(),
}).superRefine((val, ctx) => {
  if (val.decision === KycDecision.RejectedRetryable || val.decision === KycDecision.RejectedTerminal) {
    if (!val.decisionReasonCode) {
      ctx.addIssue({ code: 'custom', path: ['decisionReasonCode'], message: 'Reason code is required for rejections.' })
    }
  }
})

type FormValues = z.infer<typeof schema>

// ── Helpers ───────────────────────────────────────────────────────────────────
const DECISION_OPTIONS = [
  { value: KycDecision.Approved,          label: 'Approve',            color: '#00D98A' },
  { value: KycDecision.RejectedRetryable, label: 'Reject — Retryable', color: '#fb923c' },
  { value: KycDecision.RejectedTerminal,  label: 'Reject — Terminal',  color: '#f87171' },
]

const inputCls =
  'w-full bg-bg-elevated border border-[var(--border-subtle)] rounded-lg py-[9px] px-3 text-[13px] text-text-primary outline-none transition-colors duration-[180ms] focus:border-[var(--border-primary)]'

// ── Component ─────────────────────────────────────────────────────────────────
export function KycDecisionForm({ id, rowVersion }: { id: string; rowVersion: string | null }) {
  const [selectedDecision, setSelectedDecision] = useState<number | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const decide = useKycDecide({
    onSuccess: () => {
      toast.success('Decision saved successfully.')
      reset()
      setSelectedDecision(null)
    },
    onError: showErrorToast,
  })

  const watchedDecision = watch('decision')
  const reasonCodes =
    watchedDecision === KycDecision.RejectedRetryable ? KycRetryableReasonCodes :
    watchedDecision === KycDecision.RejectedTerminal  ? KycTerminalReasonCodes  : []

  function onSubmit(values: FormValues) {
    decide.mutate({
      id,
      decision:           values.decision as 1 | 2 | 3,
      decisionReasonCode: values.decisionReasonCode ?? null,
      decisionNote:       values.decisionNote ?? null,
    })
  }

  const isDisabled = decide.isPending || selectedDecision === null

  return (
    <div className="flex flex-col gap-5 rounded-[14px] border border-white/[0.07] bg-bg-card p-6">
      <h2 className="m-0 text-[14px] font-bold text-text-primary">Make a Decision</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[18px]">

        {/* Decision selector */}
        <div className="flex flex-col gap-2">
          <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Decision
          </label>
          <div className="flex flex-col gap-1.5">
            {DECISION_OPTIONS.map(opt => {
              const selected = selectedDecision === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setSelectedDecision(opt.value)
                    setValue('decision', opt.value, { shouldValidate: true })
                    setValue('decisionReasonCode', null)
                  }}
                  className="flex cursor-pointer items-center gap-[10px] rounded-[9px] px-[14px] py-[10px] text-left transition-all duration-[150ms]"
                  style={{
                    border:     selected ? `1.5px solid ${opt.color}40` : '1px solid rgba(255,255,255,0.07)',
                    background: selected ? `${opt.color}12` : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div
                    className="flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full"
                    style={{
                      border:     selected ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
                      background: selected ? opt.color : 'transparent',
                    }}
                  >
                    {selected && <div className="h-[5px] w-[5px] rounded-full bg-bg-primary" />}
                  </div>
                  <span
                    className="text-[13px]"
                    style={{ fontWeight: selected ? 600 : 400, color: selected ? opt.color : '#B8E6D5' }}
                  >
                    {opt.label}
                  </span>
                </button>
              )
            })}
          </div>
          {errors.decision && (
            <span className="text-[12px] text-red-400">{errors.decision.message}</span>
          )}
        </div>

        {/* Reason code — only for rejections */}
        {reasonCodes.length > 0 && (
          <div className="flex flex-col gap-[7px]">
            <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              Reason Code <span className="text-red-400">*</span>
            </label>
            <select
              {...register('decisionReasonCode')}
              defaultValue=""
              className={`${inputCls} cursor-pointer`}
            >
              <option value="" disabled>Select a reason…</option>
              {reasonCodes.map(code => (
                <option key={code} value={code}>{KycReasonCodeLabel[code] ?? code}</option>
              ))}
            </select>
            {errors.decisionReasonCode && (
              <span className="text-[12px] text-red-400">{errors.decisionReasonCode.message}</span>
            )}
          </div>
        )}

        {/* Note */}
        {selectedDecision !== null && (
          <div className="flex flex-col gap-[7px]">
            <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              Note{' '}
              <span className="font-normal normal-case tracking-normal text-[#4A7A6A]">(optional, max 1000 chars)</span>
            </label>
            <textarea
              {...register('decisionNote')}
              rows={3}
              placeholder="Add a note for this decision…"
              className={`${inputCls} resize-y leading-relaxed`}
            />
            {errors.decisionNote && (
              <span className="text-[12px] text-red-400">{errors.decisionNote.message}</span>
            )}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isDisabled}
          className={`flex items-center justify-center gap-[7px] rounded-[10px] border-none py-3 text-[14px] font-bold transition-all duration-[180ms] ${
            isDisabled
              ? 'cursor-not-allowed bg-bg-elevated text-[#4A7A6A]'
              : 'cursor-pointer bg-primary text-bg-primary hover:bg-primary-dark'
          }`}
        >
          {decide.isPending && <Loader2 size={14} className="animate-spin" />}
          {decide.isPending ? 'Submitting…' : 'Submit Decision'}
        </button>
      </form>
    </div>
  )
}
