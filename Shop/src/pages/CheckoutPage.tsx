import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { cartApi } from '../api/cart';
import {
  checkoutApi,
  PaymentMethod,
  saveCheckoutSession,
  savedCheckoutSession,
  SessionStatus,
  type CheckoutSession,
  type NewAddress,
  type PaymentMethodValue,
  type ShippingAddress,
} from '../api/checkout';
import { ApiError, messageOf } from '../api/client';
import { normalizePhone } from '../auth/api';
import { useSession } from '../auth/session';
import { BuyBar, ErrorState, Img, Loading } from '../components/ui';
import { newIdempotencyKey } from '../lib/id';
import { nav } from '../lib/nav';
import { money } from '../lib/format';
import { CART_KEY } from '../shop/cart';

export default function CheckoutPage() {
  const s = useSession();
  if (s.status === 'loading') return <Loading />;
  if (s.status !== 'signedIn') return <Navigate to="/signin?next=%2Fcheckout" replace />;
  return <Checkout />;
}

interface BundleProblem {
  groupId: string;
  message: string;
}

/** Where the place call sends the buyer next. */
export function afterPlace(session: CheckoutSession): { kind: 'redirect'; url: string } | { kind: 'placed'; orderNumber: string } | { kind: 'pending' } {
  if (session.paymentRedirectUrl) return { kind: 'redirect', url: session.paymentRedirectUrl };
  if (session.orderNumber) return { kind: 'placed', orderNumber: session.orderNumber };
  return { kind: 'pending' };
}

function Checkout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const resume = params.get('resume') === '1';
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [startError, setStartError] = useState<unknown>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [payment, setPayment] = useState<PaymentMethodValue>(PaymentMethod.CashOnDelivery);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bundleProblem, setBundleProblem] = useState<BundleProblem | null>(null);
  const placeKey = useRef<string>(newIdempotencyKey());
  const started = useRef(false);

  const addresses = useQuery({ queryKey: ['addresses'], queryFn: checkoutApi.addresses });

  async function start() {
    setStartError(null);
    try {
      let s: CheckoutSession | null = null;
      const saved = savedCheckoutSession();
      if (resume && saved) {
        try {
          const existing = await checkoutApi.get(saved);
          if ([SessionStatus.Draft, SessionStatus.Failed, SessionStatus.AwaitingPayment].includes(existing.status as 1 | 4 | 6)) s = existing;
        } catch {
          s = null;
        }
      }
      if (!s) s = await checkoutApi.start();
      saveCheckoutSession(s.id);
      setSession(s);
      if (s.shippingAddressId) setAddressId(s.shippingAddressId);
      if (s.paymentMethod === PaymentMethod.Esewa) setPayment(PaymentMethod.Esewa);
    } catch (e) {
      setStartError(e);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pick the default (or only) address once the list is in.
  useEffect(() => {
    if (addressId || !addresses.data) return;
    if (addresses.data.length === 0) setAddingAddress(true);
    const d = addresses.data.find((a) => a.isDefault) ?? addresses.data[0];
    if (d) void chooseAddress(d.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.data, session?.id]);

  const delivery = useQuery({
    queryKey: ['delivery-options', session?.id, addressId],
    queryFn: () => checkoutApi.deliveryOptions(session!.id),
    enabled: !!session && !!addressId,
    retry: false,
  });

  async function chooseAddress(id: string) {
    if (!session) return;
    setAddressId(id);
    setError(null);
    try {
      let next = await checkoutApi.setAddress(session.id, id);
      next = await checkoutApi.homeDelivery(session.id).catch(() => next);
      setSession(next);
    } catch (e) {
      setError(messageOf(e));
    }
  }

  async function place() {
    if (!session || !addressId) {
      setError('Add a delivery address first.');
      return;
    }
    setError(null);
    setBundleProblem(null);
    setBusy('Placing your order…');
    try {
      await checkoutApi.setAddress(session.id, addressId);
      await checkoutApi.homeDelivery(session.id).catch(() => undefined);
      await checkoutApi.setPayment(session.id, payment);
      const placed = await checkoutApi.place(session.id, placeKey.current);
      saveCheckoutSession(session.id);
      void qc.invalidateQueries({ queryKey: CART_KEY });
      const next = afterPlace(placed);
      if (next.kind === 'redirect') {
        setBusy('Opening eSewa…');
        nav.assign(next.url);
        return;
      }
      if (next.kind === 'placed') {
        navigate(`/orders/${encodeURIComponent(next.orderNumber)}/placed`, { replace: true });
        return;
      }
      navigate('/pay/return?payment=pending', { replace: true });
    } catch (e) {
      setBusy(null);
      placeKey.current = newIdempotencyKey();
      if (e instanceof ApiError && e.code === 'bundle_unavailable') {
        const groupId = typeof e.problem?.groupId === 'string' ? e.problem.groupId : '';
        setBundleProblem({ groupId, message: e.message });
        return;
      }
      if (e instanceof ApiError && e.code === 'method_not_available_on_web') {
        setError('That payment method isn’t available on the web. Choose eSewa or cash on delivery.');
        return;
      }
      setError(messageOf(e));
    }
  }

  async function fixBundle(how: 'remove' | 'unbundle') {
    if (!bundleProblem) return;
    setBusy('Updating your cart…');
    try {
      const cart = how === 'remove' ? await cartApi.removeBundle(bundleProblem.groupId) : await cartApi.unbundle(bundleProblem.groupId);
      qc.setQueryData(CART_KEY, cart);
      setBundleProblem(null);
      const s = await checkoutApi.start();
      saveCheckoutSession(s.id);
      setSession(s);
      if (addressId) await chooseAddress(addressId);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(null);
    }
  }

  if (startError) {
    return (
      <main className="page">
        <ErrorState error={startError} title="We couldn’t start checkout" onRetry={() => void start()} />
        <p className="center">
          <Link to="/cart">Back to cart</Link>
        </p>
      </main>
    );
  }
  if (!session) return <Loading label="Starting checkout…" />;
  if (busy) return <Loading label={busy} />;

  const currency = session.totalCurrency || 'NPR';
  const homeChoices = (delivery.data?.choices ?? []).filter((c) => c.kind === 1);

  return (
    <main className="page">
      <h1>Checkout</h1>

      <h2>1. Delivery address</h2>
      {addresses.isPending ? (
        <Loading />
      ) : addresses.error ? (
        <ErrorState error={addresses.error} onRetry={() => void addresses.refetch()} />
      ) : (
        <>
          {(addresses.data ?? []).map((a) => (
            <AddressOption key={a.id} address={a} selected={a.id === addressId} onSelect={() => void chooseAddress(a.id)} />
          ))}
          {addingAddress ? (
            <AddressForm
              first={(addresses.data ?? []).length === 0}
              onCancel={(addresses.data ?? []).length ? () => setAddingAddress(false) : undefined}
              onSaved={async (a) => {
                setAddingAddress(false);
                await addresses.refetch();
                await chooseAddress(a.id);
              }}
            />
          ) : (
            <button type="button" className="link-btn" onClick={() => setAddingAddress(true)}>
              + Add a new address
            </button>
          )}
        </>
      )}

      {addressId && (
        <>
          <h2>2. Delivery</h2>
          {delivery.isPending ? (
            <p className="muted">Checking delivery…</p>
          ) : homeChoices.length ? (
            homeChoices.map((c, i) => (
              <div key={i} className="card">
                <strong>{c.sellerName ? `${c.title} · ${c.sellerName}` : c.title}</strong>
                {c.detail && <div className="muted small">{c.detail}</div>}
              </div>
            ))
          ) : (
            <p className="muted">Home delivery to this address.</p>
          )}
        </>
      )}

      <h2>{addressId ? '3' : '2'}. Payment</h2>
      <label className={`radio-card ${payment === PaymentMethod.CashOnDelivery ? 'on' : ''}`}>
        <input type="radio" name="pay" checked={payment === PaymentMethod.CashOnDelivery} onChange={() => setPayment(PaymentMethod.CashOnDelivery)} />
        <div>
          <strong>Cash on delivery</strong>
          <div className="muted small">Pay the rider when your parcel arrives.</div>
        </div>
      </label>
      <label className={`radio-card ${payment === PaymentMethod.Esewa ? 'on' : ''}`}>
        <input type="radio" name="pay" checked={payment === PaymentMethod.Esewa} onChange={() => setPayment(PaymentMethod.Esewa)} />
        <div>
          <strong>eSewa</strong>
          <div className="muted small">You’ll be taken to eSewa to pay, then brought back here.</div>
        </div>
      </label>

      <h2>Order summary</h2>
      <div className="card">
        {session.items.map((l) => (
          <div className="row" key={l.lineId}>
            <Img className="thumb" src={l.thumbnailUrlSnapshot} alt="" />
            <div className="grow">
              <div className="ellipsis" style={{ fontWeight: 650 }}>
                {l.productTitleSnapshot}
              </div>
              <div className="muted small">
                {[l.bundleTitleSnapshot ? `Bundle: ${l.bundleTitleSnapshot}` : null, l.optionLabel ?? l.variantLabelSnapshot, `× ${l.quantity}`]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <div style={{ fontWeight: 700 }}>{money(l.lineSubtotalAmount, l.unitPriceCurrency)}</div>
          </div>
        ))}
        {(session.failedLines ?? []).map((f) => (
          <p key={f.lineId} className="err">
            {f.reasonMessage ?? 'An item can’t be ordered right now.'}
          </p>
        ))}
      </div>
      <div className="card totals">
        <span>Subtotal</span>
        <span>{money(session.subtotalAmount, currency)}</span>
        <span>Delivery</span>
        <span>{addressId ? money(session.shippingAmount, currency) : '—'}</span>
        {session.discountAmount > 0 && (
          <>
            <span>Discount</span>
            <span>−{money(session.discountAmount, currency)}</span>
          </>
        )}
        <span className="grand">Total</span>
        <span className="grand">{money(session.totalAmount, currency)}</span>
      </div>

      {bundleProblem && (
        <div className="banner danger" role="alert">
          <strong>A bundle in your cart can’t be bought right now.</strong>
          <div>{bundleProblem.message}</div>
          <div className="row" style={{ gap: 16, marginTop: 8 }}>
            <button type="button" className="link-btn" onClick={() => void fixBundle('remove')}>
              Remove bundle
            </button>
            <button type="button" className="link-btn" onClick={() => void fixBundle('unbundle')}>
              Buy items separately
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}

      <BuyBar>
        <div className="price-col">
          <div className="price" style={{ fontSize: 18 }}>
            {money(session.totalAmount, currency)}
          </div>
          <div className="muted small">{payment === PaymentMethod.Esewa ? 'Pay with eSewa' : 'Cash on delivery'}</div>
        </div>
        <button type="button" className="btn btn-primary" disabled={!addressId || session.itemCount === 0} onClick={() => void place()}>
          {payment === PaymentMethod.Esewa ? 'Pay with eSewa' : 'Place order'}
        </button>
      </BuyBar>
    </main>
  );
}

function AddressOption({ address, selected, onSelect }: { address: ShippingAddress; selected: boolean; onSelect: () => void }) {
  const where = [address.locationNote, address.addressLine1, address.city].filter(Boolean).join(', ');
  return (
    <label className={`radio-card ${selected ? 'on' : ''}`}>
      <input type="radio" name="address" checked={selected} onChange={onSelect} />
      <div className="grow">
        <strong>{address.label}</strong> · {address.receiverName}
        <div className="muted small">{address.receiverPhone}</div>
        {where && <div className="muted small">{where}</div>}
      </div>
    </label>
  );
}

export function AddressForm({ first, onSaved, onCancel }: { first: boolean; onSaved: (a: ShippingAddress) => void | Promise<void>; onCancel?: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [mapsLink, setMapsLink] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function locate() {
    setError(null);
    if (!('geolocation' in navigator)) {
      setError('Location isn’t available in this browser. Paste a Google Maps link instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy) });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError('We couldn’t get your location. Allow location, or paste a Google Maps link.');
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  async function save() {
    setError(null);
    const e164 = normalizePhone(phone);
    if (!name.trim()) return setError('Enter the receiver’s name.');
    if (!e164) return setError('Enter a valid phone number for the rider.');
    if (!area.trim()) return setError('Describe the place: area, street, landmark.');
    if (!coords && !mapsLink.trim()) return setError('Share your location or paste a Google Maps link so the rider can find you.');
    const body: NewAddress = {
      label: 'Home',
      receiverName: name.trim(),
      receiverPhone: e164,
      country: 'NP',
      locationNote: area.trim().slice(0, 500),
      city: city.trim() || undefined,
      makeDefault: first,
      ...(coords
        ? { latitude: coords.lat, longitude: coords.lng, locationAccuracyMetres: coords.acc, locationCapturedFrom: 1 }
        : { mapsLink: mapsLink.trim() }),
    };
    setSaving(true);
    try {
      const created = await checkoutApi.createAddress(body);
      await onSaved(created);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" aria-label="New address">
      <label className="field">
        <span>Receiver’s name</span>
        <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Phone number for the rider</span>
        <input className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="98XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label className="field">
        <span>Area, street and landmark</span>
        <input className="input" autoComplete="street-address" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Jhamsikhel, near the school gate" />
      </label>
      <label className="field">
        <span>City</span>
        <input className="input" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lalitpur" />
      </label>
      <button type="button" className="btn btn-ghost btn-block" onClick={locate} disabled={locating}>
        {locating ? 'Finding you…' : coords ? `Location saved (±${coords.acc} m) — update` : 'Use my current location'}
      </button>
      {!coords && (
        <label className="field">
          <span>…or paste a Google Maps link</span>
          <input className="input" inputMode="url" value={mapsLink} onChange={(e) => setMapsLink(e.target.value)} placeholder="https://maps.app.goo.gl/…" />
        </label>
      )}
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-primary grow" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save address'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
