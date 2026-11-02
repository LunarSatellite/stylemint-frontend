import { useEffect } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { catalogApi } from '../api/catalog';
import { saveCheckoutSession } from '../api/checkout';
import { ordersApi } from '../api/orders';
import { useSession } from '../auth/session';
import { Img } from '../components/ui';
import { APP_STORE_URL, money, PLAY_STORE_URL } from '../lib/format';

/** `/shop/orders/{orderNumber}/placed` — the thank-you page and the hand-over to the app (contract A5). */
export default function PlacedPage() {
  const { orderNumber = '' } = useParams();
  const [params] = useSearchParams();
  const paid = params.get('paid') === '1';
  const s = useSession();
  const order = useQuery({
    queryKey: ['order', orderNumber],
    queryFn: () => ordersApi.get(orderNumber),
    enabled: s.status === 'signedIn' && !!orderNumber,
    retry: 1,
  });
  const vendorIds = [...new Set((order.data?.subOrders ?? []).filter((so) => !so.vendorDisplayName).map((so) => so.vendorAccountId))];
  const brands = useQueries({
    queries: vendorIds.map((id) => ({ queryKey: ['brand', id], queryFn: () => catalogApi.brand(id), staleTime: 300_000, retry: false })),
  });
  const brandName = (id: string) => brands[vendorIds.indexOf(id)]?.data?.businessName ?? null;

  useEffect(() => {
    saveCheckoutSession(null);
  }, []);

  const subOrders = order.data?.subOrders ?? [];
  return (
    <main className="page">
      <div className="big-check" aria-hidden="true">
        ✓
      </div>
      <h1 className="center">{paid ? 'Paid — your order is placed' : 'Your order is placed'}</h1>
      <p className="center muted" style={{ marginTop: 0 }}>
        Order <strong style={{ color: 'var(--sm-ink)' }}>{orderNumber}</strong>
      </p>

      {subOrders.length > 0 && (
        <>
          <h2>
            {subOrders.length === 1 ? 'Your parcel' : `${subOrders.length} parcels — one from each shop`}
          </h2>
          {subOrders.map((so) => (
            <section key={so.id} className="card">
              <h3>{so.vendorDisplayName ?? brandName(so.vendorAccountId) ?? 'Shop'}</h3>
              {so.lines.map((l) => (
                <div className="row" key={l.id}>
                  <Img className="thumb" src={l.thumbnailUrlSnapshot} alt="" />
                  <div className="grow">
                    <div className="ellipsis" style={{ fontWeight: 650 }}>
                      {l.productTitleSnapshot}
                    </div>
                    <div className="muted small">{[l.optionLabel ?? l.variantLabelSnapshot, `× ${l.quantity}`].filter(Boolean).join(' · ')}</div>
                  </div>
                </div>
              ))}
            </section>
          ))}
          {order.data && (
            <div className="card totals">
              <span className="grand">Total</span>
              <span className="grand">{money(order.data.grandTotalAmount, order.data.grandTotalCurrency)}</span>
              <span className="muted">Payment</span>
              <span className="muted">{order.data.paymentMethod === 4 ? 'Cash on delivery' : order.data.paymentMethod === 3 ? 'eSewa' : '—'}</span>
            </div>
          )}
        </>
      )}

      <section className="card center" style={{ marginTop: 20 }}>
        <h3>Download the StyleMint app to track your order</h3>
        <p className="muted small" style={{ marginTop: 0 }}>
          Sign in with the same Google, Facebook or phone number you used here and your order will be waiting.
        </p>
        <div className="store-btns">
          <a className="btn btn-light btn-sm" href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
            Get it on Google Play
          </a>
          <a className="btn btn-light btn-sm" href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
            Download on the App Store
          </a>
        </div>
        <a className="btn btn-primary btn-block" href={`/app/orders/${encodeURIComponent(orderNumber)}`}>
          Open in app
        </a>
      </section>
    </main>
  );
}
