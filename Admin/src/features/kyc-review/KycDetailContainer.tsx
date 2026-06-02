import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, Clock, CalendarCheck, User, AlertTriangle, Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { components } from '@/api/schema'

type KycReviewItem = components['schemas']['KycReviewItemDto']
import { KycReviewState, KycDecision } from '@/lib/enums'
import {
  KycReviewStateLabel, KycDecisionLabel,
  KycApplicantKindLabel, KycReasonCodeLabel,
  formatDate, isOverdue,
} from '@/lib/formatters'
import { KycDecisionForm } from './KycDecisionForm'
import { useKycAssign } from '@/api/mutations/useKycAssign'
import { useAuth } from '@/auth/store'
import { showErrorToast } from '@/api/errors'
import { toast } from 'sonner'

// ── Shared card className ─────────────────────────────────────────────────────
const cardCls = 'rounded-[14px] border border-white/[0.07] bg-bg-card p-6'

// ── Field row ─────────────────────────────────────────────────────────────────
function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#4A7A6A]">
        {label}
      </span>
      <span className="text-[13px] text-text-secondary">{value}</span>
    </div>
  )
}

function StateChip({ state }: { state: number }) {
  const cfg: Record<number, { bg: string; color: string }> = {
    [KycReviewState.Pending]:  { bg: 'rgba(251,191,36,0.1)',  color: '#fbbf24' },
    [KycReviewState.InReview]: { bg: 'rgba(96,165,250,0.1)',  color: '#60a5fa' },
    [KycReviewState.Decided]:  { bg: 'rgba(0,217,138,0.1)',   color: '#00D98A' },
  }
  const c = cfg[state] ?? cfg[1]
  return (
    <span
      className="rounded-full px-3 py-[3px] text-[12px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {KycReviewStateLabel[state]}
    </span>
  )
}

function DecisionChip({ decision }: { decision: number }) {
  const cfg: Record<number, { bg: string; color: string }> = {
    [KycDecision.Approved]:          { bg: 'rgba(0,217,138,0.1)',   color: '#00D98A' },
    [KycDecision.RejectedRetryable]: { bg: 'rgba(251,146,60,0.1)',  color: '#fb923c' },
    [KycDecision.RejectedTerminal]:  { bg: 'rgba(248,113,113,0.1)', color: '#f87171' },
  }
  const c = cfg[decision] ?? { bg: 'rgba(255,255,255,0.05)', color: '#7A9B8E' }
  return (
    <span
      className="rounded-full px-3 py-[3px] text-[12px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {KycDecisionLabel[decision]}
    </span>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function KycDetailContainer({ id }: { id: string }) {
  const adminId = useAuth((s) => s.claims?.sub)

  const assign = useKycAssign({
    onSuccess: () => toast.success('Item assigned. You can now make a decision.'),
    onError:   showErrorToast,
  })

  const { data: item, isLoading } = useQuery<KycReviewItem>({
    queryKey: qk.kyc.detail(id),
    queryFn:  async () => {
      const { data } = await api.get<KycReviewItem>(`/v1/admin/kyc/${id}`)
      return data
    },
    staleTime: 10_000,
  })

  if (isLoading) return (
    <div className="flex flex-col gap-4">
      {[180, 220].map((h, i) => (
        <div key={i} className={`${cardCls} bg-white/[0.02]`} style={{ height: h }} />
      ))}
    </div>
  )

  if (!item) return (
    <div className="px-4 py-4 text-red-400">KYC item not found.</div>
  )

  const overdue   = item.state !== KycReviewState.Decided && isOverdue(item.dueByUtc)
  const canDecide = item.state === KycReviewState.InReview

  return (
    <div className="flex flex-col gap-5">

      {/* Back */}
      <div>
        <Link
          to="/kyc"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-muted no-underline transition-colors hover:text-text-secondary"
        >
          <ArrowLeft size={14} /> Back to Queue
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 mb-1 text-[20px] font-bold text-text-primary">KYC Review</h1>
          <span className="font-mono text-[12px] text-[#4A7A6A]">{item.id}</span>
        </div>
        <div className="flex items-center gap-[10px]">
          <StateChip state={item.state} />
          {overdue && (
            <span className="inline-flex items-center gap-[5px] rounded-full border border-red-400/20 bg-red-400/[0.08] px-[10px] py-[3px] text-[12px] font-semibold text-red-400">
              <AlertTriangle size={11} /> Overdue
            </span>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 items-start gap-4">

        {/* Left — Application info */}
        <div className={`${cardCls} flex flex-col gap-5`}>
          <h2 className="m-0 text-[14px] font-bold text-text-primary">Application Info</h2>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Applicant Kind"    value={KycApplicantKindLabel[item.applicantKind]} />
            <Field label="Account ID"        value={<span className="font-mono text-[12px]">{item.accountId.slice(0, 12)}…</span>} />
            <Field label="Application ID"    value={<span className="font-mono text-[12px]">{item.applicationId.slice(0, 12)}…</span>} />
            <Field label="Assigned Reviewer" value={
              item.assignedReviewerId
                ? <span className="font-mono text-[12px]">{item.assignedReviewerId.slice(0, 12)}…</span>
                : <span className="italic text-[#4A7A6A]">Unassigned</span>
            } />
          </div>

          <div className="h-px bg-white/[0.05]" />

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Submitted"
              value={
                <span className="flex items-center gap-[5px]">
                  <Clock size={12} className="text-[#4A7A6A]" /> {formatDate(item.submittedUtc)}
                </span>
              }
            />
            <Field
              label="Due By"
              value={
                <span className={`flex items-center gap-[5px] ${overdue ? 'text-red-400' : 'text-text-secondary'}`}>
                  {overdue
                    ? <AlertTriangle size={12} />
                    : <CalendarCheck size={12} className="text-[#4A7A6A]" />}
                  {formatDate(item.dueByUtc)}
                </span>
              }
            />
            {item.decidedUtc && (
              <Field
                label="Decided At"
                value={
                  <span className="flex items-center gap-[5px]">
                    <CalendarCheck size={12} className="text-primary" /> {formatDate(item.decidedUtc)}
                  </span>
                }
              />
            )}
          </div>
        </div>

        {/* Right — Decision panel */}
        <div className="flex flex-col gap-4">

          {item.state === KycReviewState.Decided && item.decision && (
            <div className={`${cardCls} flex flex-col gap-4`}>
              <h2 className="m-0 text-[14px] font-bold text-text-primary">Decision</h2>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-[10px]">
                  <DecisionChip decision={item.decision} />
                </div>
                {item.decisionReasonCode && (
                  <Field label="Reason Code" value={KycReasonCodeLabel[item.decisionReasonCode] ?? item.decisionReasonCode} />
                )}
                {item.decisionNote && (
                  <Field label="Note" value={
                    <span className="mt-0.5 block leading-relaxed text-text-muted">{item.decisionNote}</span>
                  } />
                )}
              </div>
            </div>
          )}

          {canDecide && <KycDecisionForm id={item.id} rowVersion={item.rowVersion} />}

          {item.state === KycReviewState.Pending && (
            <div className={`${cardCls} flex flex-col items-center gap-4 text-center`}>
              <User size={28} className="text-[#4A7A6A]" />
              <p className="m-0 text-[13px] leading-relaxed text-text-muted">
                This item is not yet assigned.<br />
                Assign it to yourself to begin the review.
              </p>
              <button
                disabled={assign.isPending || !adminId}
                onClick={() => assign.mutate({ id: item.id, reviewerAdminId: adminId! })}
                className={`flex items-center gap-2 rounded-[10px] border-none px-6 py-[11px] text-[13px] font-bold transition-all duration-[180ms] ${
                  assign.isPending || !adminId
                    ? 'cursor-not-allowed bg-bg-elevated text-[#4A7A6A]'
                    : 'cursor-pointer bg-primary text-bg-primary hover:bg-primary-dark'
                }`}
              >
                {assign.isPending && <Loader2 size={14} className="animate-spin" />}
                {assign.isPending ? 'Assigning…' : 'Assign to me'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
