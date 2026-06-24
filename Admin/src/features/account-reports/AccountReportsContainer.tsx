import { useState } from 'react'
import { toast } from 'sonner'
import { useSocialFeedReports } from '@/api/queries/useSocialFeedReports'
import { useResolveReport } from '@/api/mutations/useResolveReport'
import { useSocialFeedPostModerate } from '@/api/mutations/useSocialFeedPostModerate'
import { showErrorToast } from '@/api/errors'
import { AccountReportsView } from './AccountReportsView'
import type { PostReportDto } from '@/api/schema'

export function AccountReportsContainer() {
  const [resolveTarget, setResolveTarget] = useState<PostReportDto | null>(null)

  const reportsQ = useSocialFeedReports(50)

  const resolveM = useResolveReport({
    onSuccess: () => {
      toast.success('Report resolved.')
      setResolveTarget(null)
    },
    onError: showErrorToast,
  })

  const moderateM = useSocialFeedPostModerate({
    onSuccess: () => toast.success('Post moderated.'),
    onError:   showErrorToast,
  })

  if (reportsQ.isError) return (
    <div className="rounded-lg border border-red-400/20 bg-red-400/[0.08] px-4 py-4 text-red-400">
      Failed to load reports.
    </div>
  )

  return (
    <AccountReportsView
      reports={reportsQ.data ?? []}
      isLoading={reportsQ.isLoading}
      resolveTarget={resolveTarget}
      isResolving={resolveM.isPending}
      isModerating={moderateM.isPending}
      onResolveRequest={setResolveTarget}
      onResolveCancel={() => setResolveTarget(null)}
      onResolveConfirm={(terminal, reason) => {
        if (!resolveTarget) return
        resolveM.mutate({ reportId: resolveTarget.id!, terminal, reason })
      }}
      onModeratePost={(postId, action) => moderateM.mutate({ postId, action })}
    />
  )
}
