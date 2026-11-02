import { useEffect } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { catalogApi, defaultVariant, primaryImage, type BundleCard, type PagedResult } from '../api/catalog';
import { ApiError } from '../api/client';
import { ErrorState, Img, Loading, NotFoundState } from '../components/ui';
import { money } from '../lib/format';
import { rememberLastViewed } from '../shop/cart';

export default function StorePage() {
  const { id } = useParams();
  const brand = useQuery({ queryKey: ['brand', id], queryFn: () => catalogApi.brand(id!), enabled: !!id, staleTime: 300_000 });
  const products = useInfiniteQuery({
    queryKey: ['vendor-products', id],
    queryFn: ({ pageParam }) => catalogApi.vendorProducts(id!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : null),
    enabled: !!id,
  });
  // Bundles ship with the bundles backend; a missing endpoint just hides the rail.
  const bundles = useQuery({
    queryKey: ['vendor-bundles', id],
    queryFn: () => catalogApi.vendorBundles(id!).catch((): PagedResult<BundleCard> => ({ items: [], nextCursor: null, hasMore: false })),
    enabled: !!id,
  });

  useEffect(() => {
    if (id) rememberLastViewed(`/s/${id}`);
  }, [id]);

  if (brand.isPending) return <Loading />;
  if (brand.error) {
    if (brand.error instanceof ApiError && brand.error.isNotFound) return <NotFoundState what="shop" />;
    return <ErrorState error={brand.error} onRetry={() => void brand.refetch()} />;
  }
  const b = brand.data;
  const items = products.data?.pages.flatMap((p) => p.items) ?? [];
  const bundleItems = bundles.data?.items ?? [];

  return (
    <main className="page">
      <div className="store-cover" style={b.coverImageUrl ? { backgroundImage: `url("${b.coverImageUrl.replace(/"/g, '')}")` } : undefined} />
      <div className="store-head">
        <Img src={b.logoUrl} alt="" />
        <div className="grow">
          <h1 style={{ margin: 0 }}>
            {b.businessName} {b.isVerified && <span className="save-pill">Verified</span>}
          </h1>
          {b.tagline && <div className="muted small">{b.tagline}</div>}
        </div>
      </div>
      {b.description && <p className="desc">{b.description}</p>}

      {bundleItems.length > 0 && (
        <>
          <h2>Bundles</h2>
          <div className="rail">
            {bundleItems.map((x) => (
              <Link key={x.id} to={`/b/${x.id}`} className="tile">
                <Img src={x.coverImageUrl} alt="" />
                <div className="t">{x.title}</div>
                <div className="p">{x.discountPercent > 0 ? `Save ${x.discountPercent}%` : 'Bundle'}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      <h2>Products</h2>
      {products.isPending ? (
        <Loading />
      ) : products.error ? (
        <ErrorState error={products.error} onRetry={() => void products.refetch()} />
      ) : items.length === 0 ? (
        <p className="muted">No products yet.</p>
      ) : (
        <div className="grid">
          {items.map((p) => {
            const v = defaultVariant(p);
            return (
              <Link key={p.id} to={`/p/${p.id}`} className="tile">
                <Img src={primaryImage(p)} alt="" />
                <div className="t">{p.name}</div>
                {v && <div className="p">{money(v.priceAmount, v.priceCurrency)}</div>}
              </Link>
            );
          })}
        </div>
      )}
      {products.hasNextPage && (
        <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 16 }} disabled={products.isFetchingNextPage} onClick={() => void products.fetchNextPage()}>
          {products.isFetchingNextPage ? 'Loading…' : 'Show more'}
        </button>
      )}
      {b.returnPolicySummary && (
        <p className="muted small" style={{ marginTop: 24 }}>
          Returns: {b.returnPolicySummary}
        </p>
      )}
    </main>
  );
}
