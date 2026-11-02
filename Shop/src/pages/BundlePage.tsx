import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { bundleItemName, bundleUnitPrice, catalogApi, type BundleDetail, type BundleItem } from '../api/catalog';
import { ApiError, isMissingEndpoint, messageOf } from '../api/client';
import { BuyBar, ErrorState, Img, Loading, NotFoundState } from '../components/ui';
import { money } from '../lib/format';
import { bundleAttribution } from '../shop/attribution';
import { rememberLastViewed, useAddBundle } from '../shop/cart';

export function useBundle(id: string | undefined) {
  return useQuery({ queryKey: ['bundle', id], queryFn: () => catalogApi.bundle(id!), enabled: !!id, staleTime: 30_000 });
}

const UNAVAILABLE: Record<string, string> = {
  paused: 'This bundle is paused right now.',
  item_out_of_stock: 'An item in this bundle is out of stock.',
  item_unavailable: 'An item in this bundle is no longer available.',
};

export default function BundlePage() {
  const { id } = useParams();
  const q = useBundle(id);
  useEffect(() => {
    if (id) rememberLastViewed(`/b/${id}`);
  }, [id]);

  if (q.isPending) return <Loading />;
  if (q.error) {
    if (q.error instanceof ApiError && (q.error.isNotFound || isMissingEndpoint(q.error))) return <NotFoundState what="bundle" />;
    return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  }
  return <BundleView bundle={q.data} />;
}

function firstInStock(item: BundleItem): string | null {
  return item.variants.find((v) => v.inStock)?.id ?? null;
}

function BundleView({ bundle }: { bundle: BundleDetail }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const add = useAddBundle();
  const [picked, setPicked] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(bundle.items.map((i) => [i.id, firstInStock(i)])),
  );
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  // A refetched bundle (terms changed) may have different items: keep valid picks, fill the rest.
  useEffect(() => {
    setPicked((prev) =>
      Object.fromEntries(
        bundle.items.map((i) => [i.id, prev[i.id] && i.variants.some((v) => v.id === prev[i.id] && v.inStock) ? prev[i.id] : firstInStock(i)]),
      ),
    );
  }, [bundle]);

  const totals = useMemo(() => {
    let list = 0;
    let total = 0;
    for (const item of bundle.items) {
      const v = item.variants.find((x) => x.id === picked[item.id]);
      const p = v ? v.price : item.listUnitPrice;
      list += p * item.quantity;
      total += (v ? bundleUnitPrice(p, bundle.discountPercent) : item.bundleUnitPrice) * item.quantity;
    }
    return { list: Math.round(list * 100) / 100, total: Math.round(total * 100) / 100 };
  }, [bundle, picked]);

  const currency = bundle.totals?.currency ?? 'NPR';
  const missing = bundle.items.filter((i) => !picked[i.id]);
  const canAdd = bundle.isPurchasable && missing.length === 0;

  async function addBundle() {
    setError(null);
    setChanged(false);
    try {
      await add.mutateAsync({
        title: bundle.title,
        body: {
          bundleId: bundle.id,
          termsVersion: bundle.termsVersion,
          quantity: 1,
          ...bundleAttribution(bundle.id),
          variants: bundle.items.map((i) => ({ bundleItemId: i.id, productVariantId: picked[i.id]! })),
        },
      });
      navigate('/cart');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'bundle_terms_changed') {
        setChanged(true);
        await qc.invalidateQueries({ queryKey: ['bundle', bundle.id] });
        return;
      }
      if (isMissingEndpoint(e)) {
        setError('Bundles can’t be bought on the web yet. Please try again soon.');
        return;
      }
      setError(messageOf(e));
    }
  }

  return (
    <main className="page">
      <div className="hero" style={{ aspectRatio: '16 / 10' }}>
        <Img src={bundle.coverImageUrl ?? bundle.items[0]?.product?.thumbnailUrl ?? bundle.items[0]?.product?.primaryImageUrl} alt={bundle.title} />
      </div>
      <h1>{bundle.title}</h1>
      {bundle.curator && <p className="muted small" style={{ margin: 0 }}>Curated by {bundle.curator.name}</p>}
      <div style={{ marginTop: 8 }}>
        <span className="price">{money(totals.total, currency)}</span>
        {totals.list > totals.total && <span className="strike">{money(totals.list, currency)}</span>}{' '}
        {bundle.discountPercent > 0 && <span className="save-pill">Save {money(Math.round((totals.list - totals.total) * 100) / 100, currency)}</span>}
      </div>
      {bundle.description && <p className="desc">{bundle.description}</p>}
      {!bundle.isPurchasable && <div className="banner">{UNAVAILABLE[bundle.unavailableReason ?? ''] ?? 'This bundle can’t be bought right now.'}</div>}
      {changed && (
        <div className="banner" role="alert">
          This bundle just changed. Check the new items and prices, then add it again.
        </div>
      )}

      <h2>
        {bundle.items.length} item{bundle.items.length === 1 ? '' : 's'} in this bundle
      </h2>
      {bundle.items.map((item) => {
        const v = item.variants.find((x) => x.id === picked[item.id]);
        const list = v ? v.price : item.listUnitPrice;
        const unit = v ? bundleUnitPrice(list, bundle.discountPercent) : item.bundleUnitPrice;
        return (
          <section key={item.id} className="card">
            <div className="row">
              <Img className="thumb" src={item.product?.thumbnailUrl ?? item.product?.primaryImageUrl} alt="" />
              <div className="grow">
                <Link to={`/p/${item.productId}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 650 }}>
                  {bundleItemName(item)}
                </Link>
                {item.quantity > 1 && <span className="muted"> × {item.quantity}</span>}
                <div>
                  <span className="ok" style={{ fontWeight: 750 }}>
                    {money(unit, currency)}
                  </span>
                  {list > unit && <span className="strike">{money(list, currency)}</span>}
                </div>
                {item.product?.vendorDisplayName && <div className="muted small">from {item.product.vendorDisplayName}</div>}
                {item.note && <div className="muted small">{item.note}</div>}
              </div>
            </div>
            {item.variants.length > 1 && (
              <div className="chips" role="group" aria-label={`Options for ${bundleItemName(item)}`} style={{ marginTop: 10 }}>
                {item.variants.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="chip"
                    aria-pressed={opt.id === picked[item.id]}
                    disabled={!opt.inStock}
                    onClick={() => setPicked((p) => ({ ...p, [item.id]: opt.id }))}
                  >
                    {opt.label || 'Standard'}
                  </button>
                ))}
              </div>
            )}
            {!picked[item.id] && <p className="err">Out of stock</p>}
          </section>
        );
      })}

      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}

      <BuyBar>
        <div className="price-col">
          <div className="price" style={{ fontSize: 18 }}>
            {money(totals.total, currency)}
          </div>
          {totals.list > totals.total && <div className="muted small">You save {money(Math.round((totals.list - totals.total) * 100) / 100, currency)}</div>}
        </div>
        <button type="button" className="btn btn-primary" disabled={!canAdd || add.isPending} onClick={() => void addBundle()}>
          Add bundle to cart
        </button>
      </BuyBar>
    </main>
  );
}
