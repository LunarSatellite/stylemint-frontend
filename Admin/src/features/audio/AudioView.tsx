import { useState } from 'react'
import { Music2, Eye, EyeOff, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { MusicTrackRefState } from '@/lib/enums'
import { MusicTrackRefStateLabel, formatDate } from '@/lib/formatters'
import type { components } from '@/api/schema'

type MusicTrackRefDto = components['schemas']['StyleMint.Modules.Audio.Entity.MusicTrackRef.Dtos.MusicTrackRefDto']
type TrackState = typeof MusicTrackRefState[keyof typeof MusicTrackRefState]

const STATE_TABS: { label: string; value: TrackState | undefined }[] = [
  { label: 'All',           value: undefined },
  { label: 'Active',        value: MusicTrackRefState.Active },
  { label: 'Hidden',        value: MusicTrackRefState.Hidden },
  { label: 'Links Broken',  value: MusicTrackRefState.LinksBroken },
]

const STATE_BADGE: Record<number, string> = {
  [MusicTrackRefState.Active]:      'bg-emerald-400/[0.12] text-emerald-400 border-emerald-400/20',
  [MusicTrackRefState.Hidden]:      'bg-amber-400/[0.12] text-amber-400 border-amber-400/20',
  [MusicTrackRefState.LinksBroken]: 'bg-red-400/[0.12] text-red-400 border-red-400/20',
}

interface Props {
  tracks:       MusicTrackRefDto[]
  totalCount:   number
  isLoading:    boolean
  stateFilter:  TrackState | undefined
  hasNext:      boolean
  hasPrevious:  boolean
  hideTarget:   MusicTrackRefDto | null
  isHiding:     boolean
  isRestoring:  boolean
  onStateFilter: (state: TrackState | undefined) => void
  onNext:       () => void
  onPrev:       () => void
  onHideRequest: (track: MusicTrackRefDto) => void
  onHideCancel:  () => void
  onHideConfirm: (reason: string) => void
  onRestore:     (trackId: string) => void
}

export function AudioView({
  tracks, totalCount, isLoading, stateFilter,
  hasNext, hasPrevious,
  hideTarget, isHiding, isRestoring,
  onStateFilter, onNext, onPrev,
  onHideRequest, onHideCancel, onHideConfirm, onRestore,
}: Props) {
  const [hideReason, setHideReason] = useState('')

  function handleConfirm() {
    onHideConfirm(hideReason)
    setHideReason('')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* State filter tabs */}
      <div className="flex gap-2">
        {STATE_TABS.map(tab => (
          <button
            key={String(tab.value)}
            onClick={() => onStateFilter(tab.value)}
            className={`rounded-lg px-4 py-[7px] text-[13px] font-semibold transition-all duration-[150ms] ${
              stateFilter === tab.value
                ? 'bg-primary/[0.15] text-primary border border-primary/30'
                : 'border border-white/[0.07] bg-white/[0.02] text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/[0.07] bg-surface overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-white/[0.07] text-text-muted">
              <th className="py-3 px-4 text-left font-medium">Title / Artist</th>
              <th className="py-3 px-4 text-left font-medium">Duration</th>
              <th className="py-3 px-4 text-left font-medium">Genre / Mood</th>
              <th className="py-3 px-4 text-left font-medium">Reels</th>
              <th className="py-3 px-4 text-left font-medium">State</th>
              <th className="py-3 px-4 text-left font-medium">Updated</th>
              <th className="py-3 px-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-text-muted">
                  <Loader2 className="inline-block h-4 w-4 animate-spin mr-2" />
                  Loading…
                </td>
              </tr>
            ) : tracks.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-text-muted">
                    <Music2 className="h-8 w-8 opacity-30" />
                    <span>No tracks found</span>
                  </div>
                </td>
              </tr>
            ) : (
              tracks.map(track => (
                <tr
                  key={track.id}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="font-medium text-text-primary truncate max-w-[200px]">
                      {track.title ?? '—'}
                    </div>
                    <div className="text-text-muted truncate max-w-[200px]">
                      {track.artist ?? '—'}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-text-secondary">
                    {track.durationSecondsApprox
                      ? `${Math.floor(track.durationSecondsApprox / 60)}:${String(track.durationSecondsApprox % 60).padStart(2, '0')}`
                      : '—'
                    }
                  </td>
                  <td className="py-3 px-4 text-text-secondary">
                    <div>{track.genre ?? '—'}</div>
                    <div className="text-text-muted">{track.mood ?? '—'}</div>
                  </td>
                  <td className="py-3 px-4 text-text-secondary">
                    {track.citedInReelCount ?? 0}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[11px] font-medium ${STATE_BADGE[track.state ?? 0] ?? ''}`}>
                      {MusicTrackRefStateLabel[track.state ?? 0] ?? '—'}
                    </span>
                    {track.hiddenReason && (
                      <div className="mt-1 text-[11px] text-text-muted truncate max-w-[140px]" title={track.hiddenReason}>
                        {track.hiddenReason}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-text-muted whitespace-nowrap">
                    {track.updatedUtc ? formatDate(track.updatedUtc) : '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {track.state === MusicTrackRefState.Active && (
                      <button
                        onClick={() => onHideRequest(track)}
                        disabled={isHiding || isRestoring}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-[5px] text-[12px] font-medium text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                        Hide
                      </button>
                    )}
                    {track.state === MusicTrackRefState.Hidden && (
                      <button
                        onClick={() => onRestore(track.id!)}
                        disabled={isHiding || isRestoring}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-[5px] text-[12px] font-medium text-emerald-400 hover:bg-emerald-400/[0.12] transition-colors disabled:opacity-40"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-[13px] text-text-muted">
        <span>{totalCount.toLocaleString()} track{totalCount !== 1 ? 's' : ''}</span>
        <div className="flex gap-2">
          <button
            onClick={onPrev}
            disabled={!hasPrevious || isLoading}
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.07] px-3 py-[5px] hover:text-text-primary disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext || isLoading}
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.07] px-3 py-[5px] hover:text-text-primary disabled:opacity-30 transition-colors"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Hide dialog */}
      {hideTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
          onClick={(e) => { if (e.target === e.currentTarget) onHideCancel() }}
        >
          <div className="w-[420px] rounded-2xl border border-white/[0.08] bg-surface p-6 shadow-2xl">
            <h3 className="text-[15px] font-semibold text-text-primary mb-1">Hide track</h3>
            <p className="text-[13px] text-text-muted mb-4">
              <span className="text-text-secondary font-medium">{hideTarget.title ?? 'This track'}</span> will be hidden from creators. Provide an optional reason.
            </p>
            <textarea
              value={hideReason}
              onChange={e => setHideReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={3}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[13px] text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-primary/40"
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={onHideCancel}
                disabled={isHiding}
                className="rounded-lg border border-white/[0.07] px-4 py-[7px] text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isHiding}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500/90 px-4 py-[7px] text-[13px] font-semibold text-white hover:bg-amber-500 transition-colors disabled:opacity-50"
              >
                {isHiding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Hide track
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
