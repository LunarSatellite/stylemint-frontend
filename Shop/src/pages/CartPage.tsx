import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { cartApi, type CartLine, type CartView } from '../api/cart';
import { catalogApi, bundleUnitPrice, defaultVariant, primaryImage, type BundleDetail, type Product } from '../api/catalog';
import { messageOf } from '../api/client';
import { useSession } from '../auth/session';
import { BuyBar, ErrorState, Img, Loading } from '../components/ui';
import { money } from '../lib/format';
import { CART_KEY, useServerCart } from '../shop/cart';
import { guestCart, replayGuestCart, useGuestCart, type GuestItem } from '../shop/guestCart';

/** Product details for a set of product ids (shop name + image + price for grouping and guest lines). */
function useProducts(ids: string[]) {
  const results = useQueries({
    queries: ids.map((id) => ({ queryKey: ['product', id], queryFn: () => catalogApi.product(id), staleTime: 60_000, retry: false })),
  });
  const map = new Map<string, Product>();
  results.forEach((r, i) => {
    if (r.data) map.set(ids[i], r.data);
  });
  return map;
}

function useBundles(ids: string[]) {
  const results = useQueries({
    queries: ids.map((id) => ({ queryKey: ['bundle', id], queryFn: () => catalogApi.bundle(id), staleTime: 30_000, retry: false })),
  });
  const map = new Map<string, BundleDetail>();
  results.forEach((r, i) => {
    if (r.data) map.set(ids[i], r.data);
  });
  return map;
}

interface ShopGroup<T> {
  vendorId: string;
  name: string;
  items: T[];
}

function groupByShop<T>(items: T[], vendorOf: (t: T) => { id: string; name: string | null }): ShopGroup<T>[] {
  const groups = new Map<string, ShopGroup<T>>();
  for (const item of items) {
    const v = vendorOf(item);
    const g = groups.get(v.id) ?? { vendorId: v.id, name: v.name ?? 'Shop', items: [] };
    if (v.name && g.name === 'Shop') g.name = v.name;
    g.items.push(item);
    groups.set(v.id, g);
  }
  return [...groups.values()];
}

function Qty({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <span className="qty">
      <button type="button" aria-label="Decrease quantity" disabled={disabled || value <= 1} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span aria-label="Quantity">{value}</span>
      <button type="button" aria-label="Increase quantity" disabled={disabled || value >= 99} onClick={() => onChange(value + 1)}>
        +
      </button>
    </span>
  );
}

export default function CartPage() {
  const s = useSession();
  if (s.status === 'loading') return <Loading />;
  return s.status === 'signedIn' ? <ServerCart /> : <GuestCartView />;
}

function EmptyCart() {
  return (
    <main className="page">
      <div className="state">
        <p style={{ color: 'var(--sm-ink)', fontWeight: 700 }}>Your cart is empty</p>
        <p>Find something you love in a StyleMint reel.</p>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------- guest

function GuestCartView() {
  const navigate = useNavigate();
  const items = useGuestCart();
  const lines = items.filter((i): i is Extract<GuestItem, { kind: 'line' }> => i.kind === 'line');
  const bundleItems = items.filter((i): i is Extract<GuestItem, { kind: 'bundle' }> => i.kind === 'bundle');
  const products = useProducts([...new Set(lines.map((l) => l.body.productId))]);
  const bundles = useBundles([...new Set(bundleItems.map((b) => b.body.bundleId))]);

  if (items.length === 0) return <EmptyCart />;

  const unitOf = (l: (typeof lines)[number]) => {
    const p = products.get(l.body.productId);
    const v = p?.variants.find((x) => x.id === l.body.productVariantId) ?? (p ? defaultVariant(p) : null);
    return v ? v.priceAmount : null;
  };
  const bundleTotal = (b: (typeof bundleItems)[number]) => {
    const d = bundles.get(b.body.bundleId);
    if (!d) return null;
    let total = 0;
    for (const item of d.items) {
      const chosen = b.body.variants.find((x) => x.bundleItemId === item.id);
      const v = item.variants.find((x) => x.id === chosen?.productVariantId);
      total += (v ? bundleUnitPrice(v.price, d.discountPercent) : item.bundleUnitPrice) * item.quantity;
    }
    return total * b.body.quantity;
  };
  let subtotal = 0;
  for (const l of lines) subtotal += (unitOf(l) ?? 0) * l.body.quantity;
  for (const b of bundleItems) subtotal += bundleTotal(b) ?? 0;
  const currency = 'NPR';

  const groups = groupByShop(lines, (l) => {
    const p = products.get(l.body.productId);
    return { id: p?.vendorAccountId ?? 'unknown', name: p?.vendorDisplayName ?? null };
  });

  return (
    <main className="page">
      <h1>Your cart</h1>
      {bundleItems.map((b) => {
        const d = bundles.get(b.body.bundleId);
        return (
          <section key={b.key} className="card bundle-card" aria-label={`Bundle ${d?.title ?? b.title ?? ''}`}>
            <h3>
              <span className="save-pill">Bundle</span> {d?.title ?? b.title ?? 'Bundle'}
            </h3>
            {d?.items.map((item) => (
              <div className="row" key={item.id}>
                <Img className="thumb" src={item.product?.thumbnailUrl ?? item.product?.primaryImageUrl} alt="" />
                <div className="grow ellipsis">
                  {item.product?.name ?? item.product?.title ?? 'Item'} {item.quantity > 1 ? `× ${item.quantity}` : ''}
                </div>
              </div>
            ))}
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
              <span className="price" style={{ fontSize: 17 }}>
                {money(bundleTotal(b), currency)}
              </span>
              <button type="button" className="link-btn" onClick={() => guestCart.remove(b.key)}>
                Remove
              </button>
            </div>
          </section>
        );
      })}
      {groups.map((g) => (
        <section key={g.vendorId} className="card">
          <h3>{g.name}</h3>
          {g.items.map((l) => {
            const p = products.get(l.body.productId);
            const v = p?.variants.find((x) => x.id === l.body.productVariantId);
            return (
              <div className="row" key={l.key}>
                <Img className="thumb" src={p ? primaryImage(p) : null} alt="" />
                <div className="grow">
                  <Link to={`/p/${l.body.productId}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 650 }} className="ellipsis">
                    {p?.name ?? 'Loading…'}
                  </Link>
                  {v?.optionLabel && <div className="muted small">{v.optionLabel}</div>}
                  <div className="ok" style={{ fontWeight: 750 }}>
                    {money(unitOf(l), currency)}
                  </div>
                  <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                    <Qty value={l.body.quantity} onChange={(n) => guestCart.setQuantity(l.key, n)} />
                    <button type="button" className="link-btn" onClick={() => guestCart.remove(l.key)}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      ))}
      <div className="card totals">
        <span>Subtotal</span>
        <span>{money(subtotal, currency)}</span>
        <span className="muted">Delivery</span>
        <span className="muted">At checkout</span>
      </div>
      <BuyBar>
        <div className="price-col">
          <div className="price" style={{ fontSize: 18 }}>
            {money(subtotal, currency)}
          </div>
          <div className="muted small">Sign in to check out</div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/signin?next=%2Fcheckout')}>
          Checkout
        </button>
      </BuyBar>
    </main>
  );
}

// ---------------------------------------------------------------- signed in

function ServerCart() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const cart = useServerCart(true);
  const guest = useGuestCart();
  const replaying = useRef(false);
  const [replayNote, setReplayNote] = useState<string | null>(null);

  // Items added before signing in (e.g. a replay that was interrupted) are sent now.
  useEffect(() => {
    if (guest.length === 0 || replaying.current) return;
    replaying.current = true;
    void replayGuestCart()
      .then((r) => {
        if (r.failed.length) setReplayNote(`${r.failed.length} item${r.failed.length === 1 ? '' : 's'} could not be added: ${r.failed[0].message}`);
        return qc.invalidateQueries({ queryKey: CART_KEY });
      })
      .finally(() => {
        replaying.current = false;
      });
  }, [guest.length, qc]);

  const mutate = useMutation({
    mutationFn: (fn: () => Promise<CartView>) => fn(),
    onSuccess: (data) => qc.setQueryData(CART_KEY, data),
  });

  const data = cart.data;
  const plainLines = useMemo(() => (data?.lines ?? []).filter((l) => !l.bundleGroupId), [data]);
  const products = useProducts([...new Set(plainLines.filter((l) => !l.vendorAccountId).map((l) => l.productId))]);

  if (cart.isPending) return <Loading />;
  if (cart.error) return <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />;
  if (!data || data.lines.length === 0) return guest.length ? <Loading label="Adding your items…" /> : <EmptyCart />;

  const currency = data.grandTotalCurrency || 'NPR';
  const groups = groupByShop(plainLines, (l: CartLine) => {
    const p = products.get(l.productId);
    return { id: l.vendorAccountId ?? p?.vendorAccountId ?? 'unknown', name: p?.vendorDisplayName ?? null };
  });
  const bundleGroups = data.bundles ?? [];
  const broken = (data.notices ?? []).filter((n) => n.code === 'bundle_broken');
  const blocked = bundleGroups.some((b) => !b.isPurchasable);

  return (
    <main className="page">
      <h1>Your cart</h1>
      {replayNote && <div className="banner">{replayNote}</div>}
      {broken.map((n, i) => (
        <div className="banner" key={i}>
          {n.bundleTitle ? `“${n.bundleTitle}”` : 'A bundle'} was split: its remaining items are now at their normal price.
        </div>
      ))}
      {mutate.error && (
        <p className="err" role="alert">
          {messageOf(mutate.error)}
        </p>
      )}

      {bundleGroups.map((b) => {
        const lines = data.lines.filter((l) => l.bundleGroupId === b.groupId);
        return (
          <section key={b.groupId} className="card bundle-card" aria-label={`Bundle ${b.title}`}>
            <h3>
              <span className="save-pill">Bundle</span> {b.title}
            </h3>
            {lines.map((l) => (
              <div className="row" key={l.lineId}>
                <Img className="thumb" src={l.thumbnailUrlSnapshot} alt="" />
                <div className="grow">
                  <div className="ellipsis" style={{ fontWeight: 650 }}>
                    {l.productTitleSnapshot}
                  </div>
                  <div className="muted small">
                    {[l.optionLabel ?? l.variantLabelSnapshot, `× ${l.quantity}`].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <button type="button" className="link-btn" disabled={mutate.isPending} onClick={() => mutate.mutate(() => cartApi.removeLine(l.lineId))}>
                  Remove
                </button>
              </div>
            ))}
            {!b.isPurchasable && <div className="banner danger">This bundle can’t be bought right now.</div>}
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
              <div>
                <span className="price" style={{ fontSize: 17 }}>
                  {money(b.total, currency)}
                </span>
                {b.listTotal > b.total && <span className="strike">{money(b.listTotal, currency)}</span>}
              </div>
              <Qty value={b.quantity} disabled={mutate.isPending} onChange={(n) => mutate.mutate(() => cartApi.setBundleQuantity(b.groupId, n))} />
            </div>
            <div className="row" style={{ gap: 16 }}>
              <button type="button" className="link-btn" disabled={mutate.isPending} onClick={() => mutate.mutate(() => cartApi.removeBundle(b.groupId))}>
                Remove bundle
              </button>
              <button type="button" className="link-btn" disabled={mutate.isPending} onClick={() => mutate.mutate(() => cartApi.unbundle(b.groupId))}>
                Buy items separately
              </button>
            </div>
          </section>
        );
      })}

      {groups.map((g) => (
        <section key={g.vendorId} className="card">
          <h3>{g.name}</h3>
          {g.items.map((l) => (
            <div className="row" key={l.lineId}>
              <Img className="thumb" src={l.thumbnailUrlSnapshot} alt="" />
              <div className="grow">
                <Link to={`/p/${l.productId}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 650 }} className="ellipsis">
                  {l.productTitleSnapshot}
                </Link>
                {(l.optionLabel ?? l.variantLabelSnapshot) && <div className="muted small">{l.optionLabel ?? l.variantLabelSnapshot}</div>}
                <div className="ok" style={{ fontWeight: 750 }}>
                  {money(l.unitPriceAmount, l.unitPriceCurrency)}
                </div>
                <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                  <Qty value={l.quantity} disabled={mutate.isPending} onChange={(n) => mutate.mutate(() => cartApi.setQuantity(l.lineId, n))} />
                  <button type="button" className="link-btn" disabled={mutate.isPending} onClick={() => mutate.mutate(() => cartApi.removeLine(l.lineId))}>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>
      ))}

      <div className="card totals">
        <span>Subtotal</span>
        <span>{money(data.subtotalAmount, data.subtotalCurrency)}</span>
        {data.discountAmount > 0 && (
          <>
            <span>Discount</span>
            <span>−{money(data.discountAmount, currency)}</span>
          </>
        )}
        <span className="muted">Delivery</span>
        <span className="muted">At checkout</span>
      </div>

      <BuyBar>
        <div className="price-col">
          <div className="price" style={{ fontSize: 18 }}>
            {money(data.grandTotalAmount, currency)}
          </div>
          <div className="muted small">
            {data.itemCount} item{data.itemCount === 1 ? '' : 's'}
          </div>
        </div>
        <button type="button" className="btn btn-primary" disabled={blocked || mutate.isPending} onClick={() => navigate('/checkout')}>
          Checkout
        </button>
      </BuyBar>
    </main>
  );
}
