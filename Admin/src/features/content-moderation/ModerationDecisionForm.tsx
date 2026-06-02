import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useModerationDecide } from '@/api/mutations/useModerationDecide'
import { showErrorToast } from '@/api/errors'
import { ModerationAction } from '@/lib/enums'

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  action:       z.number().int().min(1).max(6),
  decisionNote: z.string().max(1000).nullable().optional(),
})

type FormValues = z.infer<typeof schema>

// ── Action options ────────────────────────────────────────────────────────────
const ACTION_OPTIONS = [
  { value: ModerationAction.NoAction,      label: 'No Action',           desc: 'Content reviewed — no enforcement needed',    color: '#7A9B8E' },
  { value: ModerationAction.HideContent,   label: 'Hide Content',         desc: 'Hidden from platform, author not notified',   color: '#fbbf24' },
  { value: ModerationAction.WarnAuthor,    label: 'Warn Author',          desc: 'Send a policy warning to the author',         color: '#fb923c' },
  { value: ModerationAction.RemoveContent, label: 'Remove Content',       desc: 'Permanently deleted from the platform',       color: '#f87171' },
  { value: ModerationAction.SuspendAuthor, label: 'Suspend Author (7d)',  desc: '7-day account suspension enforced',           color: '#ef4444' },
  { value: ModerationAction.BanAuthor,     label: 'Ban Author',           desc: 'Indefinite ban — account locked out',         color: '#dc2626' },
] as const

const inputCls =
  'w-full bg-bg-elevated border border-[var(--border-subtle)] rounded-lg py-[9px] px-3 text-[13px] text-text-primary outline-none transition-colors duration-[180ms] focus:border-[var(--border-primary)]'

// ── Component ─────────────────────────────────────────────────────────────────
export function ModerationDecisionForm({ id }: { id: string }) {
  const [selectedAction, setSelectedAction] = useState<number | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const decide = useModerationDecide({
    onSuccess: () => {
      toast.success('Decision saved successfully.')
      reset()
      setSelectedAction(null)
    },
    onError: showErrorToast,
  })

  function onSubmit(values: FormValues) {
    decide.mutate({
      id,
      action:       values.action as 1 | 2 | 3 | 4 | 5 | 6,
      decisionNote: values.decisionNote ?? null,
    })
  }

  const isDisabled = decide.isPending || selectedAction === null

  return (
    <div className="flex flex-col gap-5 rounded-[14px] border border-white/[0.07] bg-bg-card p-6">
      <h2 className="m-0 text-[14px] font-bold text-text-primary">Take Action</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[18px]">

        {/* Action selector */}
        <div className="flex flex-col gap-2">
          <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Action
          </label>
          <div className="flex flex-col gap-1.5">
            {ACTION_OPTIONS.map(opt => {
              const selected = selectedAction === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setSelectedAction(opt.value)
                    setValue('action', opt.value, { shouldValidate: true })
                  }}
                  className="flex cursor-pointer items-start gap-[10px] rounded-[9px] px-[14px] py-[10px] text-left transition-all duration-[150ms]"
                  style={{
                    border:     selected ? `1.5px solid ${opt.color}40` : '1px solid rgba(255,255,255,0.07)',
                    background: selected ? `${opt.color}12` : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div
                    className="mt-[2px] flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full"
                    style={{
                      border:     selected ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
                      background: selected ? opt.color : 'transparent',
                    }}
                  >
                    {selected && <div className="h-[5px] w-[5px] rounded-full bg-bg-primary" />}
                  </div>
                  <div className="flex flex-col gap-[2px]">
                    <span
                      className="text-[13px]"
                      style={{ fontWeight: selected ? 600 : 400, color: selected ? opt.color : '#B8E6D5' }}
                    >
                      {opt.label}
                    </span>
                    <span className="text-[11px] text-text-muted">{opt.desc}</span>
                  </div>
                </button>
              )
            })}
          </div>
          {errors.action && (
            <span className="text-[12px] text-red-400">{errors.action.message}</span>
          )}
        </div>

        {/* Note — always available once an action is selected */}
        {selectedAction !== null && (
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
