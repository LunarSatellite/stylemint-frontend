import { useParams } from 'react-router-dom'
import { useAuth } from '@/auth/store'
import { BriefingLoadingScreen } from './BriefingLoadingScreen'

export function ReelStudio() {
  const { draftId } = useParams<{ draftId: string }>()
  const briefingLoading = useAuth((s) => s.briefingLoading)

  if (briefingLoading) return <BriefingLoadingScreen />

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-text-primary">Reel Studio</h1>
      <p className="text-text-muted text-sm">Draft: {draftId}</p>
    </div>
  )
}
