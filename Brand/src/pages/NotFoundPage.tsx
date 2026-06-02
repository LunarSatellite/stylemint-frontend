import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <p className="text-5xl font-bold text-[var(--text-muted)]">404</p>
      <p className="text-lg text-[var(--text-secondary)]">Page not found</p>
      <Link
        to="/dashboard"
        className="text-sm text-[var(--primary)] underline underline-offset-2"
      >
        Go to dashboard
      </Link>
    </div>
  )
}
