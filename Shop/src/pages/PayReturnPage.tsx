import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { checkoutApi, PaymentMethod, savedCheckoutSession, SessionStatus } from '../api/checkout';
import { messageOf } from '../api/client';
import { useSession } from '../auth/session';
import { Loading } from '../components/ui';
import { newIdempotencyKey } from '../lib/id';

/**
 * `/shop/pay/return?payment=success|pending|failed&o={orderNumber}` — where eSewa sends the buyer back
 * (contract A5). The order exists only once the payment is confirmed, so without an order number the page
 * polls the saved checkout session until it is Placed (or gives up and says it is still pending).
 */

export const POLL_MS = 2_000;
export const POLL_LIMIT = 15;

type View = 'checking' | 'pending' | 'failed';

export default function PayReturnPage() {
  const s = useSession();
  const [params] = useSearchParams();
  const result = (params.get('payment') ?? '').toLowerCase();
  const orderNumber = params.get('o');

  if (result === 'success' && orderNumber) return <Navigate to={`/orders/${encodeURIComponent(orderNumber)}/placed?paid=1`} replace />;
  if (s.status === 'loading') return <Loading />;
  if (result === 'failed') return <Failed signedIn={s.status === 'signedIn'} />;
  return <Waiting signedIn={s.status === 'signedIn'} />;
}

function Waiting({ signedIn }: { signedIn: boolean }) {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('checking');
  const [round, setRound] = useState(0);
  const sessionId = savedCheckoutSession();

  useEffect(() => {
    if (!signedIn || !sessionId) {
      setView('pending');
      return;
    }
    let cancelled = false;
    let tries = 0;
    setView('checking');
    const tick = async () => {
      if (cancelled) return;
      tries++;
      try {
        const sess = await checkoutApi.get(sessionId);
        if (cancelled) return;
        if (sess.status === SessionStatus.Placed && sess.orderNumber) {
          navigate(`/orders/${encodeURIComponent(sess.orderNumber)}/placed?paid=1`, { replace: true });
          return;
        }
        if (sess.status === SessionStatus.Failed || sess.status === SessionStatus.Expired) {
          setView('failed');
          return;
        }
      } catch {
        /* keep trying */
      }
      if (tries >= POLL_LIMIT) setView('pending');
      else setTimeout(() => void tick(), POLL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [signedIn, sessionId, navigate, round]);

  if (view === 'failed') return <Failed signedIn={signedIn} />;
  if (view === 'checking') return <Loading label="Confirming your eSewa payment…" />;
  return (
    <main className="page center">
      <h1>Payment is being confirmed</h1>
      <p className="muted">
        eSewa hasn’t confirmed your payment yet. This usually takes a moment. You won’t be charged twice.
      </p>
      {signedIn && sessionId && (
        <button type="button" className="btn btn-primary" onClick={() => setRound((r) => r + 1)}>
          Check again
        </button>
      )}
      <p>
        <Link to="/cart">Back to cart</Link>
      </p>
    </main>
  );
}

function Failed({ signedIn }: { signedIn: boolean }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionId = savedCheckoutSession();

  async function payCash() {
    if (!sessionId) return navigate('/checkout');
    setBusy(true);
    setError(null);
    try {
      await checkoutApi.setPayment(sessionId, PaymentMethod.CashOnDelivery);
      const placed = await checkoutApi.place(sessionId, newIdempotencyKey());
      if (placed.orderNumber) navigate(`/orders/${encodeURIComponent(placed.orderNumber)}/placed`, { replace: true });
      else navigate('/checkout?resume=1');
    } catch (e) {
      setError(`${messageOf(e)} You can start checkout again from your cart.`);
      setBusy(false);
    }
  }

  if (busy) return <Loading label="Placing your order…" />;
  return (
    <main className="page center">
      <h1>Payment didn’t go through</h1>
      <p className="muted">No money was taken for this order. Your cart is still here.</p>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        <Link className="btn btn-primary btn-block" to={signedIn ? '/checkout?resume=1' : '/signin?next=%2Fcheckout%3Fresume%3D1'}>
          Try eSewa again
        </Link>
        {signedIn && (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => void payCash()}>
            Pay cash on delivery instead
          </button>
        )}
        <Link to="/cart">Back to cart</Link>
      </div>
    </main>
  );
}
