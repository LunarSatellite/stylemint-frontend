import { useState } from 'react'
import { toast } from 'sonner'
import { useAudioTracks } from '@/api/queries/useAudioTracks'
import { useAudioHide } from '@/api/mutations/useAudioHide'
import { useAudioRestore } from '@/api/mutations/useAudioRestore'
import { showErrorToast } from '@/api/errors'
import { AudioView } from './AudioView'
import type { AudioTracksFilter, MusicTrackRefDto } from '@/api/schema'

const PAGE_SIZE = 25

export function AudioContainer() {
  const [filter, setFilter] = useState<AudioTracksFilter>({ pageSize: PAGE_SIZE })
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const [hideTarget, setHideTarget] = useState<MusicTrackRefDto | null>(null)

  const tracksQ = useAudioTracks(filter)

  const hideM = useAudioHide({
    onSuccess: () => {
      toast.success('Track hidden.')
      setHideTarget(null)
    },
    onError: showErrorToast,
  })

  const restoreM = useAudioRestore({
    onSuccess: () => toast.success('Track restored.'),
    onError:   showErrorToast,
  })

  function setStateFilter(state: AudioTracksFilter['state'] | undefined) {
    setCursorStack([])
    setFilter(f => ({ ...f, state: state as AudioTracksFilter['state'], cursor: undefined }))
  }

  function goNext() {
    const nextCursor = tracksQ.data?.nextCursor
    if (!nextCursor) return
    setCursorStack(s => [...s, filter.cursor ?? ''])
    setFilter(f => ({ ...f, cursor: nextCursor }))
  }

  function goPrev() {
    setCursorStack(s => {
      const newStack = [...s]
      const prevCursor = newStack.pop()
      setFilter(f => ({ ...f, cursor: prevCursor || undefined }))
      return newStack
    })
  }

  if (tracksQ.isError) return (
    <div className="rounded-lg border border-red-400/20 bg-red-400/[0.08] px-4 py-4 text-red-400">
      Failed to load audio tracks.
    </div>
  )

  return (
    <AudioView
      tracks={tracksQ.data?.items ?? []}
      totalCount={tracksQ.data?.totalCount ?? 0}
      isLoading={tracksQ.isLoading}
      stateFilter={filter.state}
      hasNext={!!tracksQ.data?.nextCursor}
      hasPrevious={cursorStack.length > 0}
      hideTarget={hideTarget}
      isHiding={hideM.isPending}
      isRestoring={restoreM.isPending}
      onStateFilter={setStateFilter}
      onNext={goNext}
      onPrev={goPrev}
      onHideRequest={setHideTarget}
      onHideCancel={() => setHideTarget(null)}
      onHideConfirm={(reason) => {
        if (!hideTarget) return
        hideM.mutate({ trackId: hideTarget.id, reason })
      }}
      onRestore={(trackId) => restoreM.mutate({ trackId })}
    />
  )
}
