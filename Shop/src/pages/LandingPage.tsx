import { Link, Navigate } from 'react-router-dom';
import { APP_STORE_URL, PLAY_STORE_URL } from '../lib/format';
import { lastViewed } from '../shop/cart';

/** `/shop/` — back to the last reel / product / bundle / shop viewed, or a minimal landing. */
export default function LandingPage() {
  const last = lastViewed();
  if (last) return <Navigate to={last} replace />;
  return (
    <main className="page center">
      <div className="big-check" aria-hidden="true" style={{ fontSize: 34 }}>
        S
      </div>
      <h1>Shop the looks from StyleMint reels</h1>
      <p className="muted">Open a reel or product link shared on Instagram, Facebook or TikTok to start shopping here — no app needed.</p>
      <div className="store-btns">
        <a className="btn btn-light btn-sm" href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
          Get it on Google Play
        </a>
        <a className="btn btn-light btn-sm" href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
          Download on the App Store
        </a>
      </div>
      <Link to="/cart">Your cart</Link>
    </main>
  );
}

export function NotFoundPage() {
  return (
    <main className="page center">
      <h1>Page not found</h1>
      <p className="muted">This link doesn’t lead anywhere in the shop.</p>
      <Link className="btn btn-ghost btn-sm" to="/">
        Go to the shop
      </Link>
    </main>
  );
}
