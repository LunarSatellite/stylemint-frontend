import type { ReactNode } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { messageOf } from '../api/client';
import { useCartCount } from '../shop/cart';

export function CartIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 7h12l-1 13H7L6 7Z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </svg>
  );
}

export function Header() {
  const count = useCartCount();
  return (
    <header className="top">
      <Link to="/" className="brand" aria-label="StyleMint Shop home">
        Style<b>Mint</b>
      </Link>
      <div className="spacer" />
      <Link to="/cart" className="icon-btn" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}>
        <CartIcon />
        {count > 0 && <span className="badge">{count > 99 ? '99+' : count}</span>}
      </Link>
    </header>
  );
}

export function Layout() {
  return (
    <div className="app">
      <Header />
      <Outlet />
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state" role="status">
      <div className="spinner" />
      {label}
    </div>
  );
}

export function ErrorState({ error, title, onRetry }: { error?: unknown; title?: string; onRetry?: () => void }) {
  return (
    <div className="state" role="alert">
      <p style={{ color: 'var(--sm-ink)', fontWeight: 700, margin: '0 0 6px' }}>{title ?? 'Something went wrong'}</p>
      {error !== undefined && <p style={{ margin: 0 }}>{messageOf(error)}</p>}
      {onRetry && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function NotFoundState({ what = 'page' }: { what?: string }) {
  return (
    <div className="state">
      <p style={{ color: 'var(--sm-ink)', fontWeight: 700, margin: '0 0 6px' }}>This {what} isn’t available</p>
      <p style={{ margin: '0 0 16px' }}>It may have been removed or the link is wrong.</p>
      <Link className="btn btn-ghost btn-sm" to="/cart">
        Go to your cart
      </Link>
    </div>
  );
}

export function BuyBar({ children }: { children: ReactNode }) {
  return (
    <div className="buybar">
      <div className="buybar-inner">{children}</div>
    </div>
  );
}

export function Img({ src, alt, className }: { src: string | null | undefined; alt: string; className?: string }) {
  if (!src) return <div className={className ? `${className} ph` : 'ph'} aria-hidden="true" />;
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />;
}
