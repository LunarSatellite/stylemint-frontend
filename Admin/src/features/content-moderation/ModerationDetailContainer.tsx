import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, Clock, CalendarCheck, User, Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { ModerationItemDto } from '@/api/schema'

type ModerationItem = ModerationItemDto
import { ModerationItemState, ModerationSource, ModerationTargetKind, ModerationAction } from '@/lib/enums'
import {
  ModerationItemStateLabel,
  ModerationTargetKindLabel,
  ModerationSourceLabel,
  ModerationActionLabel,
  ModerationReportReasonCodeLabel,
  formatDate,
} from '@/lib/formatters'
import { ModerationDecisionForm } from './ModerationDecisionForm'
import { useModerationAssign } from '@/api/mutations/useModerationAssign'
import { useAuth } from '@/auth/store'
import { showErrorToast } from '@/api/errors'
import { toast } from 'sonner'

// ── Shared card className ─────────────────────────────────────────────────────
const cardCls = 'rounded-[14px] border border-white/[0.07] bg-bg-card p-6'

// ── Field row ─────────────────────────────────────────────────────────────────
function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#4A7A6A]">{label}</span>
      <span className="text-[13px] text-text-secondary">{value}</span>
    </div>
  )
}

// ── Chips ─────────────────────────────────────────────────────────────────────
function StateBadge({ state }: { state: number }) {
  const cfg: Record<number, { bg: string; color: string }> = {
    [ModerationItemState.Open]:     { bg: 'rgba(251,191,36,0.1)',  color: '#fbbf24' },
    [ModerationItemState.InReview]: { bg: 'rgba(96,165,250,0.1)',  color: '#60a5fa' },
    [ModerationItemState.Decided]:  { bg: 'rgba(0,217,138,0.1)',   color: '#00D98A' },
  }
  const c = cfg[state] ?? cfg[1]
  return (
    <span
      className="rounded-full px-3 py-[3px] text-[12px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {ModerationItemStateLabel[state]}
    </span>
  )
}

function TargetKindBadge({ kind }: { kind: number }) {
  const cfg: Record<number, { bg: string; color: string }> = {
    [ModerationTargetKind.Reel]:        { bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa' },
    [ModerationTargetKind.Review]:      { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa' },
    [ModerationTargetKind.ReelComment]: { bg: 'rgba(0,217,138,0.1)',    color: '#00D98A' },
    [ModerationTargetKind.Profile]:     { bg: 'rgba(251,191,36,0.1)',   color: '#fbbf24' },
  }
  const c = cfg[kind] ?? { bg: 'rgba(255,255,255,0.05)', color: '#7A9B8E' }
  return (
    <span
      className="rounded-full px-3 py-[3px] text-[12px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {ModerationTargetKindLabel[kind]}
    </span>
  )
}

function SourceBadge({ source }: { source: number }) {
  const cfg: Record<number, { bg: string; color: string }> = {
    [ModerationSource.UserReport]:       { bg: 'rgba(251,146,60,0.1)',   color: '#fb923c' },
    [ModerationSource.AutomatedScanner]: { bg: 'rgba(96,165,250,0.1)',   color: '#60a5fa' },
    [ModerationSource.AdminSpot]:        { bg: 'rgba(255,255,255,0.06)', color: '#7A9B8E' },
  }
  const c = cfg[source] ?? { bg: 'rgba(255,255,255,0.05)', color: '#7A9B8E' }
  return (
    <span
      className="rounded-full px-3 py-[3px] text-[12px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {ModerationSourceLabel[source]}
    </span>
  )
}

function ActionBadge({ action }: { action: number }) {
  const cfg: Record<number, { bg: string; color: string }> = {
    [ModerationAction.NoAction]:      { bg: 'rgba(255,255,255,0.06)', color: '#7A9B8E' },
    [ModerationAction.HideContent]:   { bg: 'rgba(251,191,36,0.1)',   color: '#fbbf24' },
    [ModerationAction.RemoveContent]: { bg: 'rgba(248,113,113,0.1)',  color: '#f87171' },
    [ModerationAction.WarnAuthor]:    { bg: 'rgba(251,146,60,0.1)',   color: '#fb923c' },
    [ModerationAction.SuspendAuthor]: { bg: 'rgba(239,68,68,0.1)',    color: '#ef4444' },
    [ModerationAction.BanAuthor]:     { bg: 'rgba(220,38,38,0.12)',   color: '#dc2626' },
  }
  const c = cfg[action] ?? { bg: 'rgba(255,255,255,0.05)', color: '#7A9B8E' }
  return (
    <span
      className="rounded-full px-3 py-[3px] text-[12px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {ModerationActionLabel[action]}
    </span>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function ModerationDetailContainer({ id }: { id: string }) {
  const adminId = useAuth((s) => s.claims?.sub)

  const assign = useModerationAssign({
    onSuccess: () => toast.success('Item assigned. You can now take action.'),
    onError:   showErrorToast,
  })

  const { data: item, isLoading } = useQuery<ModerationItem>({
    queryKey: qk.moderation.detail(id),
    queryFn:  async () => {
      const { data } = await api.get<ModerationItem>(`/v1/admin/moderation/${id}`)
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
    <div className="px-4 py-4 text-red-400">Moderation item not found.</div>
  )

  const canDecide = item.state === ModerationItemState.InReview

  return (
    <div className="flex flex-col gap-5">

      {/* Back */}
      <div>
        <Link
          to="/moderation"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-muted no-underline transition-colors hover:text-text-secondary"
        >
          <ArrowLeft size={14} /> Back to Queue
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 mb-1 text-[20px] font-bold text-text-primary">Moderation Review</h1>
          <span className="font-mono text-[12px] text-[#4A7A6A]">{item.id}</span>
        </div>
        <div className="flex items-center gap-[10px]">
          <StateBadge state={item.state!} />
          <TargetKindBadge kind={item.targetKind!} />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 items-start gap-4">

        {/* Left — Item info */}
        <div className={`${cardCls} flex flex-col gap-5`}>
          <h2 className="m-0 text-[14px] font-bold text-text-primary">Item Info</h2>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Content Type" value={<TargetKindBadge kind={item.targetKind!} />} />
            <Field label="Source"       value={<SourceBadge source={item.source!} />} />
            <Field
              label="Target ID"
              value={<span className="font-mono text-[12px]">{item.targetId!.slice(0, 16)}…</span>}
            />
            <Field
              label="Assigned Reviewer"
              value={
                item.assignedReviewerId
                  ? <span className="font-mono text-[12px]">{item.assignedReviewerId.slice(0, 12)}…</span>
                  : <span className="italic text-[#4A7A6A]">Unassigned</span>
              }
            />
          </div>

          {/* Reporter section — only for user reports */}
          {item.source === ModerationSource.UserReport && (
            <>
              <div className="h-px bg-white/[0.05]" />
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Reporter Account"
                  value={
                    item.reporterAccountId
                      ? <span className="font-mono text-[12px]">{item.reporterAccountId.slice(0, 12)}…</span>
                      : <span className="italic text-[#4A7A6A]">Anonymous</span>
                  }
                />
                <Field
                  label="Report Reason"
                  value={
                    item.reportReasonCode
                      ? (ModerationReportReasonCodeLabel[item.reportReasonCode] ?? item.reportReasonCode)
                      : <span className="italic text-[#4A7A6A]">—</span>
                  }
                />
              </div>
            </>
          )}

          <div className="h-px bg-white/[0.05]" />

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Submitted"
              value={
                <span className="flex items-center gap-[5px]">
                  <Clock size={12} className="text-[#4A7A6A]" /> {formatDate(item.submittedUtc!)}
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

          {/* Existing decision — read-only when Decided */}
          {item.state === ModerationItemState.Decided && item.action && (
            <div className={`${cardCls} flex flex-col gap-4`}>
              <h2 className="m-0 text-[14px] font-bold text-text-primary">Decision</h2>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-[10px]">
                  <ActionBadge action={item.action} />
                </div>
                {item.decisionNote && (
                  <Field label="Note" value={
                    <span className="mt-0.5 block leading-relaxed text-text-muted">{item.decisionNote}</span>
                  } />
                )}
              </div>
            </div>
          )}

          {/* Decision form — only when InReview */}
          {canDecide && <ModerationDecisionForm id={item.id!} />}

          {/* Open — not yet assigned */}
          {item.state === ModerationItemState.Open && (
            <div className={`${cardCls} flex flex-col items-center gap-4 text-center`}>
              <User size={28} className="text-[#4A7A6A]" />
              <p className="m-0 text-[13px] leading-relaxed text-text-muted">
                This item is not yet assigned.<br />
                Assign it to yourself to begin moderation.
              </p>
              <button
                disabled={assign.isPending || !adminId}
                onClick={() => assign.mutate({ id: item.id!, reviewerAdminId: adminId! })}
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
