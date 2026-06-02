import { useParams } from 'react-router-dom'
import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { BriefEditorRoot } from '@/features/brief-authoring/BriefEditorRoot'
import { asBriefId } from '@/lib/brands'

export default function BriefEditorPage() {
  const { id } = useParams<{ id: string }>()
  if (!id) return null

  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <BriefEditorRoot briefId={asBriefId(id)} />
    </ErrorBoundary>
  )
}
