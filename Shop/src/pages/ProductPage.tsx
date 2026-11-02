import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { catalogApi, defaultVariant, primaryImage, variantInStock, type Product } from '../api/catalog';
import { ApiError, messageOf } from '../api/client';
import { BuyBar, ErrorState, Img, Loading, NotFoundState } from '../components/ui';
import { money } from '../lib/format';
import { productAttribution } from '../shop/attribution';
import { rememberLastViewed, useAddLine } from '../shop/cart';

export function useProduct(id: string | undefined) {
  return useQuery({ queryKey: ['product', id], queryFn: () => catalogApi.product(id!), enabled: !!id, staleTime: 60_000 });
}

export default function ProductPage() {
  const { id } = useParams();
  const q = useProduct(id);
  useEffect(() => {
    if (!id) return;
    rememberLastViewed(`/p/${id}`);
    catalogApi.productView(id).catch(() => undefined);
  }, [id]);

  if (q.isPending) return <Loading />;
  if (q.error) {
    if (q.error instanceof ApiError && q.error.isNotFound) return <NotFoundState what="product" />;
    return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  }
  return <ProductView product={q.data} />;
}

function ProductView({ product }: { product: Product }) {
  const navigate = useNavigate();
  const add = useAddLine();
  const [variantId, setVariantId] = useState<string | null>(() => {
    const d = defaultVariant(product);
    if (product.requiresOptionSelection && product.variants.length > 1) return null;
    return d && variantInStock(d) ? d.id : (product.variants.find(variantInStock)?.id ?? d?.id ?? null);
  });
  const [added, setAdded] = useState(false);
  const [slide, setSlide] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const images = useMemo(
    () => [...(product.images ?? [])].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder),
    [product.images],
  );
  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  const shown = variant ?? defaultVariant(product);
  const flash = product.activeFlashSale;
  const price = shown?.priceAmount ?? flash?.salePrice ?? 0;
  const currency = shown?.priceCurrency ?? 'NPR';
  const compareAt = flash && flash.originalPrice > price ? flash.originalPrice : null;
  const sellable = product.state === 2 && !product.isService;
  const inStock = variant ? variantInStock(variant) : product.isInStock !== false && product.variants.some(variantInStock);
  const showVariants = product.variants.length > 1;

  async function addToCart(thenGo: boolean) {
    setError(null);
    if (!variant) {
      setError('Choose an option first.');
      return;
    }
    try {
      await add.mutateAsync({ productId: product.id, productVariantId: variant.id, quantity: 1, ...productAttribution(product.id) });
      setAdded(true);
      if (thenGo) navigate('/cart');
    } catch (e) {
      setError(messageOf(e));
    }
  }

  return (
    <main className="page">
      {images.length > 1 ? (
        <>
          <div
            className="gallery"
            onScroll={(e) => {
              const el = e.currentTarget;
              setSlide(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
            }}
          >
            {images.map((img, i) => (
              <img key={img.id} src={img.cdnUrl} alt={i === 0 ? product.name : ''} loading={i === 0 ? 'eager' : 'lazy'} />
            ))}
          </div>
          <div className="dots" aria-hidden="true">
            {images.map((img, i) => (
              <span key={img.id} className={i === slide ? 'on' : ''} />
            ))}
          </div>
        </>
      ) : (
        <div className="hero">
          <Img src={primaryImage(product)} alt={product.name} />
        </div>
      )}

      <h1>{product.name}</h1>
      <div>
        <span className="price">{money(price, currency)}</span>
        {compareAt && <span className="strike">{money(compareAt, currency)}</span>}
      </div>
      {product.reviewCount ? (
        <p className="muted small" style={{ margin: '4px 0 0' }}>
          ★ {product.averageRating?.toFixed(1)} · {product.reviewCount} review{product.reviewCount === 1 ? '' : 's'}
        </p>
      ) : null}

      {showVariants && (
        <>
          <h2>Choose an option</h2>
          <div className="chips" role="group" aria-label="Options">
            {product.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                className="chip"
                aria-pressed={v.id === variantId}
                disabled={!variantInStock(v)}
                onClick={() => {
                  setVariantId(v.id);
                  setAdded(false);
                }}
              >
                {v.optionLabel || 'Standard'}
              </button>
            ))}
          </div>
        </>
      )}

      <Link className="seller-row" to={`/s/${product.vendorAccountId}`}>
        <Img src={product.vendorAvatarUrl} alt="" />
        <div className="grow">
          <div className="muted small">Sold by</div>
          <div style={{ fontWeight: 700 }}>{product.vendorDisplayName || 'Visit the shop'}</div>
        </div>
        <span aria-hidden="true">›</span>
      </Link>

      {product.shortDescription && <p className="desc">{product.shortDescription}</p>}
      {product.longDescriptionMarkdown && <p className="desc">{stripMarkdown(product.longDescriptionMarkdown)}</p>}
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}

      <BuyBar>
        <div className="price-col">
          <div className="price" style={{ fontSize: 18 }}>
            {money(price, currency)}
          </div>
          <div className="muted small ellipsis">
            {!sellable ? 'Available in the StyleMint app' : !inStock ? 'Out of stock' : variant?.optionLabel || 'Cash on delivery or eSewa'}
          </div>
        </div>
        {added ? (
          <Link className="btn btn-primary" to="/cart">
            View cart
          </Link>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" disabled={!sellable || !inStock || add.isPending} onClick={() => void addToCart(false)}>
              Add
            </button>
            <button type="button" className="btn btn-primary" disabled={!sellable || !inStock || add.isPending} onClick={() => void addToCart(true)}>
              Buy now
            </button>
          </>
        )}
      </BuyBar>
    </main>
  );
}

/** Descriptions are Markdown; this shop renders plain text (never raw HTML). */
function stripMarkdown(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*_`>]/g, '')
    .trim();
}
