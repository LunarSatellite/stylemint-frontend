import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { catalogApi, type TaggedBundle, type TaggedProduct } from '../api/catalog';
import { ApiError } from '../api/client';
import { BuyBar, ErrorState, Img, Loading, NotFoundState } from '../components/ui';
import { money } from '../lib/format';
import { readAttribution, writeAttribution } from '../shop/attribution';
import { rememberLastViewed } from '../shop/cart';

/**
 * Reels-first: the reel fills the screen with its shoppable tags on top. Tapping a tag opens the product /
 * bundle with that reel tag as its attribution, so `reelTagContextId` / `taggedBundleId` go on the add call.
 */
export default function ReelPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const reel = useQuery({ queryKey: ['reel', id], queryFn: () => catalogApi.reel(id!), enabled: !!id });
  // Bundle tags ship with the bundles backend; until then this 404s and the rail shows products only.
  const bundles = useQuery({
    queryKey: ['reel-bundles', id],
    queryFn: () => catalogApi.reelBundles(id!).catch(() => [] as TaggedBundle[]),
    enabled: !!id,
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (id) rememberLastViewed(`/r/${id}`);
  }, [id]);

  if (reel.isPending) return <Loading />;
  if (reel.error) {
    if (reel.error instanceof ApiError && reel.error.isNotFound) return <NotFoundState what="reel" />;
    return <ErrorState error={reel.error} onRetry={() => void reel.refetch()} />;
  }
  const r = reel.data;
  const products = (r.taggedProducts ?? []).filter((t) => !t.isService && t.addableToCart !== false);
  const tagBundles = Array.isArray(bundles.data) ? bundles.data : [];

  function tag(t: string, target: string) {
    const current = readAttribution();
    writeAttribution({ t, tFor: target, ref: current?.ref ?? null, utm: current?.utm ?? {}, savedMs: Date.now() });
  }

  function openProduct(p: TaggedProduct) {
    tag(p.id, `p:${p.productId.toLowerCase()}`);
    navigate(`/p/${p.productId}`);
  }

  function openBundle(b: TaggedBundle) {
    tag(b.taggedBundleId, `b:${b.bundle.id.toLowerCase()}`);
    navigate(`/b/${b.bundle.id}`);
  }

  const single = products.length === 1 && tagBundles.length === 0 ? products[0] : null;

  return (
    <main className="page">
      <div className="reel">
        {r.videoCdnUrl ? (
          <video ref={videoRef} src={r.videoCdnUrl} poster={r.thumbnailCdnUrl ?? undefined} autoPlay muted={muted} loop playsInline preload="metadata" />
        ) : (
          <Img src={r.thumbnailCdnUrl} alt={r.caption ?? 'Reel'} />
        )}
        {r.videoCdnUrl && (
          <button type="button" className="mute-btn" onClick={() => setMuted((m) => !m)}>
            {muted ? 'Sound on' : 'Mute'}
          </button>
        )}
        <div className="reel-meta">
          <div className="reel-creator">
            {r.creatorAvatarUrl && <img src={r.creatorAvatarUrl} alt="" />}
            <span>{r.creatorDisplayName ?? 'StyleMint creator'}</span>
          </div>
          {r.caption && <p className="reel-caption">{r.caption}</p>}
          <div className="tag-rail" aria-label="Shop this reel">
            {tagBundles.map((b) => (
              <button key={b.taggedBundleId} type="button" className="tag-card" onClick={() => openBundle(b)}>
                <Img src={b.bundle.coverImageUrl} alt="" />
                <div className="grow">
                  <div className="t">{b.bundle.title}</div>
                  <div className="p">{b.bundle.discountPercent > 0 ? `Bundle · save ${b.bundle.discountPercent}%` : 'Bundle'}</div>
                </div>
              </button>
            ))}
            {products.map((p) => (
              <button key={p.id} type="button" className="tag-card" onClick={() => openProduct(p)}>
                <Img src={p.productPrimaryImageUrl} alt="" />
                <div className="grow">
                  <div className="t">{p.productName}</div>
                  <div className="p">{money(p.productPriceSnapshotAmount, p.productPriceSnapshotCurrency)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {products.length === 0 && tagBundles.length === 0 && <p className="muted center">Nothing to shop in this reel yet.</p>}

      <BuyBar>
        <div className="price-col">
          <div style={{ fontWeight: 750 }}>Shop this look</div>
          <div className="muted small ellipsis">
            {products.length + tagBundles.length} item{products.length + tagBundles.length === 1 ? '' : 's'} tagged
          </div>
        </div>
        {single ? (
          <button type="button" className="btn btn-primary" onClick={() => openProduct(single)}>
            Buy
          </button>
        ) : (
          <Link className="btn btn-ghost" to="/cart">
            Cart
          </Link>
        )}
      </BuyBar>
    </main>
  );
}
