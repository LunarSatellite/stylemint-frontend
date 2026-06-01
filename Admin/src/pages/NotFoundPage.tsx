import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
      <p className="text-5xl font-bold text-text-primary">404</p>
      <p className="text-lg">Page not found</p>
      <Link to="/kyc" className="text-primary underline text-sm">Back to dashboard</Link>
    </div>
  )
}
