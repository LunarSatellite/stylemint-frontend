// DEV ONLY — prototype view for Admin KYC Review queue (Scenario A & B)

import { AlertTriangle, Clock, GitFork } from 'lucide-react'
import type { KycReviewItemDto } from '@/api/schema'
import { KycReviewState, KycApplicantKind, KycDecision, ApplicationState } from '@/lib/enums'
import {
  KycReviewStateLabel, KycApplicantKindLabel, KycDecisionLabel,
  ApplicationStateLabel, formatDateShort, formatDate, isOverdue,
} from '@/lib/formatters'
import type { KycReviewItemB } from './_seed/kycReviewSeedB'

type KycReviewItem = KycReviewItemDto

// ── Badges ────────────────────────────────────────────────────────────────────

function StateBadge({ state }: { state: number }) {
  const cfg: Record<number, { bg: string; color: string }> = {
    [KycReviewState.Pending]:  { bg: 'rgba(251,191,36,0.1)',  color: '#fbbf24' },
    [KycReviewState.InReview]: { bg: 'rgba(96,165,250,0.1)',  color: '#60a5fa' },
    [KycReviewState.Decided]:  { bg: 'rgba(0,217,138,0.1)',   color: '#00D98A' },
  }
  const c = cfg[state] ?? cfg[1]
  return (
    <span
      className="inline-flex items-center gap-[5px] rounded-full px-[10px] py-[3px] text-[11px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      <span className="h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: c.color }} />
      {KycReviewStateLabel[state] ?? state}
    </span>
  )
}

function KindBadge({ kind }: { kind: number }) {
  const cfg: Record<number, { bg: string; color: string }> = {
    [KycApplicantKind.Creator]: { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa' },
    [KycApplicantKind.Vendor]:  { bg: 'rgba(251,146,60,0.1)',   color: '#fb923c' },
  }
  const c = cfg[kind] ?? { bg: 'rgba(255,255,255,0.05)', color: '#7A9B8E' }
  return (
    <span
      className="rounded-full px-[10px] py-[3px] text-[11px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {KycApplicantKindLabel[kind] ?? kind}
    </span>
  )
}

function DecisionBadge({ decision }: { decision: number }) {
  const cfg: Record<number, { bg: string; color: string }> = {
    [KycDecision.Approved]:          { bg: 'rgba(0,217,138,0.1)',   color: '#00D98A' },
    [KycDecision.RejectedRetryable]: { bg: 'rgba(251,191,36,0.1)',  color: '#fbbf24' },
    [KycDecision.RejectedTerminal]:  { bg: 'rgba(248,113,113,0.1)', color: '#f87171' },
  }
  const c = cfg[decision] ?? { bg: 'rgba(255,255,255,0.05)', color: '#7A9B8E' }
  return (
    <span
      className="rounded-full px-[10px] py-[3px] text-[11px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {KycDecisionLabel[decision] ?? decision}
    </span>
  )
}

function AppStateBadge({ state }: { state: number }) {
  const cfg: Record<number, { bg: string; color: string }> = {
    [ApplicationState.Draft]:       { bg: 'rgba(255,255,255,0.05)', color: '#7A9B8E' },
    [ApplicationState.Submitted]:   { bg: 'rgba(251,191,36,0.08)',  color: '#fbbf24' },
    [ApplicationState.UnderReview]: { bg: 'rgba(96,165,250,0.08)',  color: '#60a5fa' },
    [ApplicationState.Approved]:    { bg: 'rgba(0,217,138,0.08)',   color: '#00D98A' },
    [ApplicationState.Rejected]:    { bg: 'rgba(248,113,113,0.08)', color: '#f87171' },
  }
  const c = cfg[state] ?? cfg[1]
  return (
    <span
      className="rounded-full border px-[10px] py-[3px] text-[11px] font-semibold"
      style={{ background: c.bg, color: c.color, borderColor: `${c.color}30`, borderStyle: 'dashed' }}
    >
      {ApplicationStateLabel[state] ?? state}
    </span>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  scenario: 'A' | 'B'
  items: KycReviewItem[] | KycReviewItemB[]
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function KycReviewQueueView({ scenario, items }: Props) {
  const isB = scenario === 'B'

  const headers = isB
    ? ['Kind', 'Account ID', 'Review State', 'App State', 'Assigned Reviewer', 'Due By', 'Decision', '']
    : ['Kind', 'Account ID', 'State', 'Assigned Reviewer', 'Due By', 'Decision', '']

  return (
    <div className="flex flex-col gap-4">

      {/* Scenario banner */}
      {!isB ? (
        <div
          className="flex items-start gap-2.5 rounded-lg px-4 py-3 text-[12px]"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}
        >
          <AlertTriangle size={13} className="mt-[1px] shrink-0" />
          <div>
            <span className="font-bold">Scenario A — Unified flow.</span>
            {' '}Deciding here (approve/reject) would also update the creator/vendor application state.
            The Creator and Vendor tabs would become redundant.
            Hardcoded seed — pending backend confirmation.
          </div>
        </div>
      ) : (
        <div
          className="flex items-start gap-2.5 rounded-lg px-4 py-3 text-[12px]"
          style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa' }}
        >
          <GitFork size={13} className="mt-[1px] shrink-0" />
          <div>
            <span className="font-bold">Scenario B — Two independent systems.</span>
            {' '}The <span className="font-semibold">Review State</span> column is this queue.
            The <span className="font-semibold dashed">App State</span> (dashed border) is the linked creator/vendor application — tracked separately.
            Both can be in completely different states at the same time.
            Hardcoded seed — pending backend confirmation.
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto overflow-hidden rounded-[12px] border border-white/[0.06] bg-bg-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {headers.map(h => (
                <th
                  key={h}
                  className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#4A7A6A]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const overdue = item.dueByUtc
                ? item.state !== KycReviewState.Decided && isOverdue(item.dueByUtc)
                : false
              const itemB = item as KycReviewItemB

              return (
                <tr
                  key={item.id}
                  className={`transition-colors duration-[150ms] hover:bg-white/[0.02] ${
                    idx < items.length - 1 ? 'border-b border-white/[0.04]' : ''
                  }`}
                >
                  {/* Kind */}
                  <td className="px-4 py-[14px]">
                    <KindBadge kind={item.applicantKind!} />
                  </td>

                  {/* Account ID */}
                  <td className="px-4 py-[14px]">
                    <span className="font-mono text-[12px] text-text-secondary">
                      {item.accountId?.slice(0, 8)}…
                    </span>
                  </td>

                  {/* Review State */}
                  <td className="px-4 py-[14px]">
                    <StateBadge state={item.state!} />
                  </td>

                  {/* App State — Scenario B only */}
                  {isB && (
                    <td className="px-4 py-[14px]">
                      <AppStateBadge state={itemB._appState} />
                    </td>
                  )}

                  {/* Assigned Reviewer */}
                  <td className="px-4 py-[14px]">
                    {item.assignedReviewerId
                      ? <span className="font-mono text-[12px] text-text-secondary">{item.assignedReviewerId.slice(0, 12)}…</span>
                      : <span className="text-[12px] italic text-[#4A7A6A]">Unassigned</span>
                    }
                  </td>

                  {/* Due By */}
                  <td className="whitespace-nowrap px-4 py-[14px]">
                    <span className={`flex items-center gap-1.5 text-[13px] ${overdue ? 'text-red-400' : 'text-text-muted'}`}>
                      {overdue && <AlertTriangle size={12} />}
                      <Clock size={12} className={overdue ? 'text-red-400' : 'text-[#4A7A6A]'} />
                      {item.dueByUtc ? formatDateShort(item.dueByUtc) : '—'}
                      {overdue && <span className="text-[11px] font-semibold">OVERDUE</span>}
                    </span>
                  </td>

                  {/* Decision */}
                  <td className="px-4 py-[14px]">
                    {item.decision != null
                      ? <DecisionBadge decision={item.decision} />
                      : <span className="text-[12px] text-[#4A7A6A]">—</span>
                    }
                  </td>

                  {/* Action */}
                  <td className="px-4 py-[14px] text-right">
                    {item.state === KycReviewState.Pending && (
                      <button
                        className="cursor-pointer whitespace-nowrap rounded-[6px] border border-sky-400/20 bg-sky-400/[0.08] px-3 py-[5px] text-[12px] font-semibold text-sky-400 transition-colors duration-[150ms] hover:bg-sky-400/[0.15]"
                        title={`Would call POST /v1/admin/kyc/${item.id}/assign`}
                      >
                        Assign to me
                      </button>
                    )}
                    {item.state === KycReviewState.InReview && (
                      <button
                        className="cursor-pointer whitespace-nowrap rounded-[6px] border border-primary/20 bg-primary/[0.08] px-3 py-[5px] text-[12px] font-semibold text-primary transition-colors duration-[150ms] hover:bg-primary/[0.15]"
                        title={`Would call POST /v1/admin/kyc/${item.id}/decide`}
                      >
                        Review →
                      </button>
                    )}
                    {item.state === KycReviewState.Decided && item.decidedUtc && (
                      <span className="text-[11px] text-[#4A7A6A]">
                        {formatDate(item.decidedUtc)}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#4A7A6A]">
        <span>
          Review lifecycle: <strong className="text-text-muted">Pending</strong> → assign →{' '}
          <strong className="text-text-muted">In Review</strong> → decide →{' '}
          <strong className="text-text-muted">Decided</strong>
        </span>
        {isB && (
          <>
            <span>·</span>
            <span>
              <span
                className="rounded-full border px-2 py-[1px] text-[10px]"
                style={{ borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', color: '#7A9B8E' }}
              >
                dashed
              </span>
              {' '}= linked application state (independent system)
            </span>
          </>
        )}
        <span>·</span>
        <span className="flex items-center gap-1"><AlertTriangle size={11} className="text-red-400" /> = overdue</span>
      </div>
    </div>
  )
}
