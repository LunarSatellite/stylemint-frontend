import { useState } from 'react'
import { usePlatformConfigSet } from '@/api/mutations/usePlatformConfigSet'
import { showErrorToast } from '@/api/errors'
import { toast } from 'sonner'
import { Pencil, X, Check } from 'lucide-react'
import type { PlatformConfigEntryDto } from '@/api/schema'

type ConfigEntry = PlatformConfigEntryDto

function ConfigRow({ entry }: { entry: ConfigEntry }) {
  const [editing, setEditing]   = useState(false)
  const [value, setValue]       = useState(entry.valueJson ?? '')
  const set = usePlatformConfigSet({
    onSuccess: () => { toast.success('Config updated'); setEditing(false) },
    onError:   showErrorToast,
  })

  function handleSave() {
    if (!entry.key) return
    set.mutate({ key: entry.key, valueJson: value, description: entry.description ?? undefined })
  }

  function handleCancel() {
    setValue(entry.valueJson ?? '')
    setEditing(false)
  }

  return (
    <div className="rounded-lg border border-[var(--surface-border)] bg-bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-semibold text-text-primary">{entry.key}</p>
          {entry.description && (
            <p className="mt-0.5 text-xs text-text-muted">{entry.description}</p>
          )}
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-white/[0.05] hover:text-text-primary"
          >
            <Pencil size={12} />
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-[var(--border-primary)] bg-bg-elevated px-3 py-2 font-mono text-xs text-text-primary outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={set.isPending}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-bg-primary disabled:opacity-50"
            >
              <Check size={12} />
              {set.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 rounded-md border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
            >
              <X size={12} />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <pre className="mt-3 overflow-x-auto rounded-md bg-bg-elevated px-3 py-2 font-mono text-xs text-text-secondary">
          {entry.valueJson ?? '—'}
        </pre>
      )}
    </div>
  )
}

interface Props { config: ConfigEntry[] | undefined; isLoading?: boolean }

export function PlatformConfigView({ config, isLoading }: Props) {
  if (isLoading) return <div className="text-text-muted">Loading…</div>
  if (!config?.length) return <div className="text-sm text-text-muted">No platform config entries found.</div>
  return (
    <div className="space-y-3">
      {config.map((entry) => (
        <ConfigRow key={entry.key} entry={entry} />
      ))}
    </div>
  )
}
