import { useState } from 'react'
import { Flag, Loader2, EyeOff, Trash2 } from 'lucide-react'
import { PostReportState } from '@/lib/enums'
import { PostReportStateLabel, PostReportReasonLabel, formatDate } from '@/lib/formatters'
import type { components } from '@/api/schema'

type PostReportDto = components['schemas']['StyleMint.Modules.SocialFeed.Entity.PostReport.Dtos.PostReportDto']

const STATE_BADGE: Record<number, string> = {
  [PostReportState.Open]:         'bg-blue-400/[0.12] text-blue-400 border-blue-400/20',
  [PostReportState.InReview]:     'bg-amber-400/[0.12] text-amber-400 border-amber-400/20',
  [PostReportState.Resolved]:     'bg-emerald-400/[0.12] text-emerald-400 border-emerald-400/20',
  [PostReportState.Dismissed]:    'bg-white/[0.06] text-text-muted border-white/[0.07]',
  [PostReportState.AutoResolved]: 'bg-purple-400/[0.12] text-purple-400 border-purple-400/20',
}

const TERMINAL_OPTIONS = [
  { value: PostReportState.Resolved,  label: 'Resolved — action taken' },
  { value: PostReportState.Dismissed, label: 'Dismissed — no action' },
]

interface Props {
  reports:       PostReportDto[]
  isLoading:     boolean
  resolveTarget: PostReportDto | null
  isResolving:   boolean
  isModerating:  boolean
  onResolveRequest: (r: PostReportDto) => void
  onResolveCancel:  () => void
  onResolveConfirm: (terminal: number, reason: string) => void
  onModeratePost:   (postId: string, action: 'hide' | 'remove' | 'restore') => void
}

export function AccountReportsView({
  reports, isLoading, resolveTarget, isResolving, isModerating,
  onResolveRequest, onResolveCancel, onResolveConfirm, onModeratePost,
}: Props) {
  const [terminal, setTerminal] = useState<number>(PostReportState.Resolved)
  const [note,     setNote]     = useState('')

  function handleConfirm() {
    onResolveConfirm(terminal, note)
    setNote('')
    setTerminal(PostReportState.Resolved)
  }

  const openReports = reports.filter(r => r.state === PostReportState.Open || r.state === PostReportState.InReview)
  const closedReports = reports.filter(r => r.state !== PostReportState.Open && r.state !== PostReportState.InReview)

  return (
    <div className="flex flex-col gap-6">
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-muted">
          <Flag className="h-10 w-10 opacity-20" />
          <span>No reports found</span>
        </div>
      ) : (
        <>
          {openReports.length > 0 && (
            <section>
              <h2 className="text-[13px] font-semibold text-text-muted uppercase tracking-wide mb-3">
                Needs Review ({openReports.length})
              </h2>
              <ReportTable
                reports={openReports}
                isModerating={isModerating}
                onResolveRequest={onResolveRequest}
                onModeratePost={onModeratePost}
                showActions
              />
            </section>
          )}
          {closedReports.length > 0 && (
            <section>
              <h2 className="text-[13px] font-semibold text-text-muted uppercase tracking-wide mb-3">
                Closed ({closedReports.length})
              </h2>
              <ReportTable
                reports={closedReports}
                isModerating={isModerating}
                onResolveRequest={onResolveRequest}
                onModeratePost={onModeratePost}
                showActions={false}
              />
            </section>
          )}
        </>
      )}

      {/* Resolve dialog */}
      {resolveTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
          onClick={(e) => { if (e.target === e.currentTarget) onResolveCancel() }}
        >
          <div className="w-[440px] rounded-2xl border border-white/[0.08] bg-surface p-6 shadow-2xl">
            <h3 className="text-[15px] font-semibold text-text-primary mb-1">Resolve report</h3>
            <p className="text-[13px] text-text-muted mb-4">
              Post: <span className="font-mono text-text-secondary text-[11px]">{resolveTarget.postId}</span>
            </p>

            <div className="flex flex-col gap-2 mb-4">
              {TERMINAL_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="terminal"
                    value={opt.value}
                    checked={terminal === opt.value}
                    onChange={() => setTerminal(opt.value)}
                    className="accent-primary"
                  />
                  <span className="text-[13px] text-text-secondary">{opt.label}</span>
                </label>
              ))}
            </div>

            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Resolution note (optional)"
              rows={2}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[13px] text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-primary/40"
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={onResolveCancel}
                disabled={isResolving}
                className="rounded-lg border border-white/[0.07] px-4 py-[7px] text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isResolving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-[7px] text-[13px] font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isResolving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReportTable({
  reports, isModerating, onResolveRequest, onModeratePost, showActions,
}: {
  reports: PostReportDto[]
  isModerating: boolean
  onResolveRequest: (r: PostReportDto) => void
  onModeratePost:   (postId: string, action: 'hide' | 'remove' | 'restore') => void
  showActions: boolean
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-surface overflow-hidden">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-white/[0.07] text-text-muted">
            <th className="py-3 px-4 text-left font-medium">Post ID</th>
            <th className="py-3 px-4 text-left font-medium">Reason</th>
            <th className="py-3 px-4 text-left font-medium">State</th>
            <th className="py-3 px-4 text-left font-medium">Reported</th>
            {showActions && <th className="py-3 px-4 text-right font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {reports.map(r => (
            <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
              <td className="py-3 px-4">
                <span className="font-mono text-[11px] text-text-secondary">{r.postId}</span>
                {r.context && (
                  <div className="text-[11px] text-text-muted mt-0.5 truncate max-w-[180px]" title={r.context}>
                    {r.context}
                  </div>
                )}
              </td>
              <td className="py-3 px-4 text-text-secondary">
                {PostReportReasonLabel[r.reason ?? 0] ?? `Reason ${r.reason}`}
              </td>
              <td className="py-3 px-4">
                <span className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[11px] font-medium ${STATE_BADGE[r.state ?? 0] ?? ''}`}>
                  {PostReportStateLabel[r.state ?? 0] ?? '—'}
                </span>
              </td>
              <td className="py-3 px-4 text-text-muted whitespace-nowrap">
                {r.createdUtc ? formatDate(r.createdUtc) : '—'}
              </td>
              {showActions && (
                <td className="py-3 px-4">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => r.postId && onModeratePost(r.postId, 'hide')}
                      disabled={isModerating || !r.postId}
                      title="Hide post"
                      className="rounded-lg border border-white/[0.07] px-2.5 py-[5px] text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => r.postId && onModeratePost(r.postId, 'remove')}
                      disabled={isModerating || !r.postId}
                      title="Remove post"
                      className="rounded-lg border border-red-400/20 bg-red-400/[0.05] px-2.5 py-[5px] text-red-400 hover:bg-red-400/[0.12] transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onResolveRequest(r)}
                      className="rounded-lg border border-primary/20 bg-primary/[0.08] px-3 py-[5px] text-[12px] font-medium text-primary hover:bg-primary/[0.15] transition-colors"
                    >
                      Resolve
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
