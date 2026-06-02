export function BriefingLoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg-primary"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-surface-2 border-t-primary" />
      <p className="text-text-secondary">Analyzing your draft…</p>
      <p className="text-text-muted text-sm">This takes up to 15 seconds.</p>
    </div>
  )
}
