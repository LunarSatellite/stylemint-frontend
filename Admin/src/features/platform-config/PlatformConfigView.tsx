export function PlatformConfigView({ config, isLoading }: { config: unknown; isLoading?: boolean }) {
  if (isLoading) return <div className="text-text-muted">Loading…</div>
  return <div className="bg-bg-card border border-[var(--surface-border)] rounded-lg p-6">{/* config form */}</div>
}
