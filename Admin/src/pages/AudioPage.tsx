import { Suspense } from 'react'
import { Music2, Loader2 } from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AudioContainer } from '@/features/audio/AudioContainer'

export default function AudioPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.07]">
          <Music2 className="h-4 w-4 text-text-muted" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold text-text-primary leading-tight">Audio Tracks</h1>
          <p className="text-[13px] text-text-muted">Review and moderate music tracks</p>
        </div>
      </div>

      <ErrorBoundary fallback={
        <div className="rounded-lg border border-red-400/20 bg-red-400/[0.08] px-4 py-4 text-red-400">
          Failed to load audio tracks.
        </div>
      }>
        <Suspense fallback={
          <div className="flex items-center justify-center py-16 text-text-muted">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading…
          </div>
        }>
          <AudioContainer />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
