import { Link } from 'react-router-dom'
import { AlertTriangle, Clock } from 'lucide-react'
import type { ModerationItemDto } from '@/api/schema'
import { ModerationItemState, ModerationTargetKind, ModerationSource } from '@/lib/enums'
import { ModerationItemStateLabel, ModerationTargetKindLabel, ModerationSourceLabel, ModerationReportReasonCodeLabel, formatDateShort } from '@/lib/formatters'

function StateBadge({ state }: { state: number }) {
  const cfg: Record<number, { bg: string; color: string; dot: string }> = {
    [ModerationItemState.Open]:     { bg: 'rgba(251,191,36,0.1)',  color: '#fbbf24', dot: '#fbbf24' },
    [ModerationItemState.InReview]: { bg: 'rgba(96,165,250,0.1)',  color: '#60a5fa', dot: '#60a5fa' },
    [ModerationItemState.Decided]:  { bg: 'rgba(0,217,138,0.1)',   color: '#00D98A', dot: '#00D98A' },
  }
  const c = cfg[state] ?? cfg[1]
  return (
    <span
      className="inline-flex items-center gap-[5px] rounded-full px-[10px] py-[3px] text-[11px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      <span className="h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: c.dot }} />
      {ModerationItemStateLabel[state] ?? state}
    </span>
  )
}

function TargetKindBadge({ kind }: { kind: number }) {
  const cfg: Record<number, { bg: string; color: string }> = {
    [ModerationTargetKind.Reel]:        { bg: 'rgba(96,165,250,0.12)',   color: '#60a5fa' },
    [ModerationTargetKind.Review]:       { bg: 'rgba(167,139,250,0.12)',  color: '#a78bfa' },
    [ModerationTargetKind.ReelComment]:  { bg: 'rgba(0,217,138,0.1)',     color: '#00D98A' },
    [ModerationTargetKind.Profile]:      { bg: 'rgba(251,191,36,0.1)',    color: '#fbbf24' },
  }
  const c = cfg[kind] ?? { bg: 'rgba(255,255,255,0.05)', color: '#7A9B8E' }
  return (
    <span
      className="rounded-full px-[10px] py-[3px] text-[11px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {ModerationTargetKindLabel[kind] ?? kind}
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
      className="rounded-full px-[10px] py-[3px] text-[11px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {ModerationSourceLabel[source] ?? source}
    </span>
  )
}

interface Props {
  items: ModerationItemDto[]
}

export function ModerationSeedView({ items }: Props) {
  return (
    <div className="flex flex-col gap-4">

      {/* Scenario banner */}
      <div
        className="flex items-start gap-2.5 rounded-lg px-4 py-3 text-[12px]"
        style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}
      >
        <AlertTriangle size={13} className="mt-[1px] shrink-0" />
        <div>
          <span className="font-bold">Scenario A — Moderation queue prototype.</span>
          {' '}Hardcoded seed data — pending backend API integration.
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto overflow-hidden rounded-[12px] border border-white/[0.06] bg-bg-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {['Target ID', 'Kind', 'Source', 'Reason', 'State', 'Submitted', ''].map(h => (
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
            {items.map((item, idx) => (
              <tr
                key={item.id}
                className={`transition-colors duration-[150ms] hover:bg-white/[0.02] ${
                  idx < items.length - 1 ? 'border-b border-white/[0.04]' : ''
                }`}
              >
                {/* Target ID */}
                <td className="px-4 py-[14px]">
                  <span className="font-mono text-[12px] text-text-secondary">
                    {item.targetId?.slice(0, 8)}…
                  </span>
                </td>

                {/* Kind */}
                <td className="px-4 py-[14px]">
                  <TargetKindBadge kind={item.targetKind!} />
                </td>

                {/* Source */}
                <td className="px-4 py-[14px]">
                  <SourceBadge source={item.source!} />
                </td>

                {/* Reason code */}
                <td className="px-4 py-[14px]">
                  {item.reportReasonCode
                    ? <span className="text-[12px] text-text-muted">
                        {ModerationReportReasonCodeLabel[item.reportReasonCode] ?? item.reportReasonCode}
                      </span>
                    : <span className="text-[12px] text-[#4A7A6A]">—</span>
                  }
                </td>

                {/* State */}
                <td className="px-4 py-[14px]">
                  <StateBadge state={item.state!} />
                </td>

                {/* Submitted */}
                <td className="whitespace-nowrap px-4 py-[14px]">
                  <span className="flex items-center gap-1.5 text-[13px] text-text-muted">
                    <Clock size={12} className="text-[#4A7A6A]" />
                    {item.submittedUtc ? formatDateShort(item.submittedUtc) : '—'}
                  </span>
                </td>

                {/* Action */}
                <td className="px-4 py-[14px] text-right">
                  {item.state === ModerationItemState.Open && (
                    <button
                      className="cursor-pointer whitespace-nowrap rounded-[6px] border border-sky-400/20 bg-sky-400/[0.08] px-3 py-[5px] text-[12px] font-semibold text-sky-400 transition-colors duration-[150ms] hover:bg-sky-400/[0.15]"
                      title="Would call POST /v1/admin/moderation/{id}/assign"
                    >
                      Assign to me
                    </button>
                  )}
                  {item.state === ModerationItemState.InReview && (
                    <Link
                      to={`/moderation/${item.id}`}
                      className="whitespace-nowrap rounded-[6px] border border-primary/20 bg-primary/[0.08] px-3 py-[5px] text-[12px] font-semibold text-primary no-underline transition-colors duration-[150ms] hover:bg-primary/[0.15]"
                    >
                      Review →
                    </Link>
                  )}
                  {item.state === ModerationItemState.Decided && item.decidedUtc && (
                    <span className="text-[11px] text-[#4A7A6A]">
                      Resolved {formatDateShort(item.decidedUtc)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#4A7A6A]">
        <span>
          Moderation lifecycle: <strong className="text-text-muted">Open</strong> → assign →{' '}
          <strong className="text-text-muted">In Review</strong> → decide →{' '}
          <strong className="text-text-muted">Decided</strong>
        </span>
        <span>·</span>
        <span>
          Content types: <strong className="text-text-muted">Reel</strong>,{' '}
          <strong className="text-text-muted">Review</strong>,{' '}
          <strong className="text-text-muted">Comment</strong>,{' '}
          <strong className="text-text-muted">Profile</strong>
        </span>
      </div>
    </div>
  )
}
