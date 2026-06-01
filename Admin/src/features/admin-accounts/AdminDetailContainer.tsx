import { useAdminAccount } from '@/api/queries/useAdminAccounts'
import { useDisableAdmin } from '@/api/mutations/useDisableAdmin'
import { useEnableAdmin } from '@/api/mutations/useEnableAdmin'
import { showErrorToast } from '@/api/errors'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { AdminAccountState } from '@/lib/enums'
import { permissions } from '@/lib/permissions'
import { useAuth } from '@/auth/store'

export function AdminDetailContainer({ id }: { id: string }) {
  const { data, isLoading } = useAdminAccount(id)
  const claims = useAuth((s) => s.claims)
  const roles: string[] = claims?.roles ?? []
  const disable = useDisableAdmin({ onSuccess: () => toast.success('Account disabled'), onError: showErrorToast })
  const enable = useEnableAdmin({ onSuccess: () => toast.success('Account enabled'), onError: showErrorToast })
  if (isLoading) return <div className="text-text-muted">Loading…</div>
  if (!data) return null
  return (
    <div className="bg-bg-card border border-[var(--surface-border)] rounded-lg p-6 space-y-4">
      <p className="text-text-primary font-medium">{data.email}</p>
      {permissions.canManageAdmins(roles) && (
        <div className="flex gap-3">
          {data.state === AdminAccountState.Active
            ? <ConfirmDialog title="Disable account?" description="The admin will lose access immediately." onConfirm={() => disable.mutate({ id })} trigger={<Button variant="destructive" disabled={disable.isPending}>Disable</Button>} />
            : <ConfirmDialog title="Enable account?" description="The admin will regain access." onConfirm={() => enable.mutate({ id })} trigger={<Button className="bg-primary hover:bg-primary-dark text-bg-primary" disabled={enable.isPending}>Enable</Button>} />
          }
        </div>
      )}
    </div>
  )
}
