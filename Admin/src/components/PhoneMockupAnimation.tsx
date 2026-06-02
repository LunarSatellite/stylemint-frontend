import { useEffect } from 'react'
import type { ReactNode } from 'react'

const STYLES = `
@keyframes pma-bsx  { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
@keyframes pma-csy  { 0%{transform:translateY(0)} 100%{transform:translateY(-50%)} }
@keyframes pma-pdot { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:.4} }
.pma-bscroll { animation:pma-bsx 13s linear infinite; display:flex; gap:7px; width:max-content }
.pma-cscroll { animation:pma-csy 16s linear infinite }
.pma-pdot    { animation:pma-pdot 1.4s infinite }
`

const G   = '#00D98A'
const DK  = '#0A1612'
const DKC = '#132420'
const WM  = '#7A9B8E'
const PU  = '#a78bfa'
const AM  = '#fbbf24'
const CO  = '#f87171'
const BL  = '#60a5fa'

/* ── Primitives ─────────────────────────────────────────────────────────────── */

function Topbar({ gemBg, init, name, pillBg, pillTxt, dotBg, label }: {
  gemBg: string; init: string; name: string
  pillBg: string; pillTxt: string; dotBg: string; label: string
}) {
  return (
    <div className="mb-1 flex shrink-0 items-center px-[14px]">
      <div className="flex items-center gap-1.5">
        <div
          className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px]"
          style={{ background: gemBg }}
        >
          <span className="text-[12px] font-extrabold text-white">{init}</span>
        </div>
        <span className="text-[13px] font-extrabold text-white">{name}</span>
      </div>
      <div
        className="ml-auto flex items-center gap-1 rounded-[8px] px-2 py-[2px]"
        style={{ background: pillBg }}
      >
        <div className="pma-pdot h-[5px] w-[5px] rounded-full" style={{ background: dotBg }} />
        <span className="text-[10px] font-bold" style={{ color: pillTxt }}>{label}</span>
      </div>
    </div>
  )
}

function SL({ text }: { text: string }) {
  return (
    <div className="mb-[3px] shrink-0 px-[14px] text-[10px] font-bold uppercase tracking-[2px] text-text-muted">
      {text}
    </div>
  )
}

/* ── Brand screens ──────────────────────────────────────────────────────────── */

function BrandHome() {
  const brands = [
    { e: '🌿', n: 'NaturalKit', c: 'Skincare',  ac: G  },
    { e: '💎', n: 'Luxora',     c: 'Luxury',    ac: PU },
    { e: '☕', n: 'BrewRoots',  c: 'Beverages', ac: AM },
    { e: '🏡', n: 'ZenHome',   c: 'Home',      ac: BL },
    { e: '⚡', n: 'FitFuel',   c: 'Fitness',   ac: CO },
  ]
  const prods = [
    { e: '👗', n: 'Linen Set',   p: '$89'  },
    { e: '💄', n: 'Velvet Lip',  p: '$34'  },
    { e: '🌿', n: 'Green Serum', p: '$67'  },
    { e: '🧴', n: 'Hydra Cream', p: '$45'  },
    { e: '👟', n: 'Trail Pro',   p: '$129' },
    { e: '☕', n: 'Cold Brew',   p: '$28'  },
  ]
  const stats = [
    { v: '$48.2K', l: 'Revenue'   },
    { v: '1.2K',   l: 'Creators'  },
    { v: '94%',    l: 'Fulfilled' },
  ]
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar gemBg={G} init="B" name="Brand Studio" pillBg="rgba(0,217,138,.1)" pillTxt={G} dotBg={G} label="LIVE" />
      <div className="mb-[3px] h-[100px] shrink-0 overflow-hidden px-[14px]">
        <div className="pma-bscroll">
          {[...brands, ...brands].map((b, i) => (
            <div
              key={i}
              className="flex shrink-0 flex-col items-center gap-0.5 rounded-[12px] px-[7px] pb-[6px] pt-2"
              style={{ width: 84, height: 96, background: DKC, borderTop: `2px solid ${b.ac}` }}
            >
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[8px] bg-white/[0.05] text-[18px]">
                {b.e}
              </div>
              <span className="text-center text-[10px] font-bold leading-[1.2] text-text-secondary">{b.n}</span>
              <span className="text-[8px] text-text-muted">{b.c}</span>
            </div>
          ))}
        </div>
      </div>
      <SL text="Top products" />
      <div className="mb-[3px] grid shrink-0 grid-cols-3 gap-1 px-[14px]">
        {prods.map((p, i) => (
          <div key={i} className="flex flex-col items-center gap-[1px] rounded-[8px] border border-white/[0.06] bg-bg-card px-1 py-[5px]">
            <span className="text-[18px]">{p.e}</span>
            <span className="text-center text-[10px] font-semibold leading-[1.2] text-text-secondary">{p.n}</span>
            <span className="text-[10px] font-bold text-primary">{p.p}</span>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 gap-1 px-[14px]">
        {stats.map((s, i) => (
          <div key={i} className="flex-1 rounded-[8px] border border-white/[0.06] bg-bg-card px-1 py-[5px] text-center">
            <div className="text-[13px] font-extrabold text-white">{s.v}</div>
            <div className="text-[8px] text-text-muted">{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BrandBriefs() {
  const briefs = [
    { t: 'Summer Glow', st: 'Locked', sBg: 'rgba(0,217,138,.12)', sC: G,  g: 'Drive awareness for SPF range',   m: '50 creators · 3mo', roi: '4.2×' },
    { t: 'Urban Fit Q3',st: 'Draft',  sBg: 'rgba(251,191,36,.12)',sC: AM, g: 'Gym wear launch campaign',          m: '30 creators · $12K', roi: '—'   },
    { t: 'Brew & Chill', st: 'Locked', sBg: 'rgba(0,217,138,.12)', sC: G, g: 'Lifestyle content for cold brew',  m: '25 creators · 2mo', roi: '3.8×' },
    { t: 'Home Stories', st: 'Retired',sBg: 'rgba(255,255,255,.06)',sC: WM,g: 'Home decor showcase',             m: '40 creators · 4mo', roi: '2.1×' },
  ]
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar gemBg={G} init="B" name="Brand Studio" pillBg="rgba(251,191,36,.1)" pillTxt={AM} dotBg={AM} label="BRIEFS" />
      <SL text="Campaign briefs" />
      <div className="flex flex-col gap-[3px] px-[14px]">
        {briefs.map((b, i) => (
          <div
            key={i}
            id={`brand-brief-${i}`}
            className="rounded-[10px] border border-white/[0.06] bg-bg-card px-[10px] py-[7px]"
            style={{ opacity: 0, transform: 'translateY(10px)' }}
          >
            <div className="mb-[2px] flex items-center justify-between">
              <span className="text-[12px] font-bold text-text-secondary">{b.t}</span>
              <span
                className="rounded-[4px] px-[6px] py-[1px] text-[9px] font-bold"
                style={{ color: b.sC, background: b.sBg }}
              >
                {b.st}
              </span>
            </div>
            <div className="mb-[3px] text-[10px] text-text-muted">{b.g}</div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-text-muted">{b.m}</span>
              <span className="text-[11px] font-extrabold text-primary">{b.roi}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BrandAnalytics() {
  const kpis = [
    { v: '$124K',  l: 'Revenue', d: '+18%' },
    { v: '8.4K',   l: 'Orders',  d: '+12%' },
    { v: '$14.76', l: 'AOV',     d: '+5%'  },
  ]
  const bh = [35, 50, 45, 60, 70, 75, 100]
  const bc = ['rgba(0,217,138,.35)','rgba(0,217,138,.42)','rgba(0,217,138,.48)','rgba(0,217,138,.52)','rgba(0,217,138,.58)','rgba(0,217,138,.65)', G]
  const days = ['M','T','W','T','F','S','S']
  const creators = [
    { in: 'JL', gr: 'linear-gradient(135deg,#00D98A,#00B872)', h: '@jordanlux', r: '$8.4K' },
    { in: 'SK', gr: 'linear-gradient(135deg,#a78bfa,#7c3aed)', h: '@softkit',   r: '$6.2K' },
    { in: 'MV', gr: 'linear-gradient(135deg,#fbbf24,#f59e0b)', h: '@minivera',  r: '$4.8K' },
  ]
  return (
    <div className="flex flex-1 flex-col gap-[5px] overflow-hidden">
      <Topbar gemBg={G} init="B" name="Brand Studio" pillBg="rgba(96,165,250,.1)" pillTxt={BL} dotBg={BL} label="30d" />
      <SL text="Analytics overview" />
      <div className="grid shrink-0 grid-cols-3 gap-1 px-[14px]">
        {kpis.map((k, i) => (
          <div
            key={i}
            id={`brand-kpi-${i}`}
            className="rounded-[8px] border border-white/[0.06] bg-bg-card px-[7px] py-[6px]"
            style={{ opacity: 0, transform: 'translateY(8px)' }}
          >
            <div className="text-[14px] font-extrabold leading-[1] text-white">{k.v}</div>
            <div className="my-[2px] text-[8px] text-text-muted">{k.l}</div>
            <div className="text-[9px] font-bold text-primary">{k.d}</div>
          </div>
        ))}
      </div>
      <div
        id="brand-chart-card"
        className="mx-[14px] mt-[3px] shrink-0 rounded-[10px] border border-white/[0.06] bg-bg-card px-[10px] py-[7px]"
        style={{ opacity: 0, transform: 'translateY(8px)' }}
      >
        <div className="mb-[5px] text-[11px] font-bold text-text-secondary">Weekly Revenue</div>
        <div className="flex h-[58px] items-end gap-1">
          {bh.map((h, i) => (
            <div key={i} className="flex h-full flex-1 items-end">
              <div
                id={`brand-bar-${i}`}
                className="w-full rounded-[3px_3px_0_0]"
                style={{ height: `${h}%`, background: bc[i], transform: 'scaleY(0)', transformOrigin: 'bottom' }}
              />
            </div>
          ))}
        </div>
        <div className="mt-[3px] flex gap-1">
          {days.map((d, i) => (
            <div key={i} className="flex-1 text-center text-[8px] text-text-muted">{d}</div>
          ))}
        </div>
      </div>
      <div
        id="brand-creators-card"
        className="mx-[14px] mt-[3px] shrink-0 rounded-[10px] border border-white/[0.06] bg-bg-card px-[10px] py-[7px]"
        style={{ opacity: 0, transform: 'translateY(8px)' }}
      >
        <div className="mb-1 text-[11px] font-bold text-text-secondary">Top Creators</div>
        {creators.map((c, i) => (
          <div
            key={i}
            id={`brand-creator-row-${i}`}
            className="flex items-center gap-[7px]"
            style={{ marginBottom: i < 2 ? 3 : 0, opacity: 0, transform: 'translateY(8px)' }}
          >
            <div
              className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
              style={{ background: c.gr }}
            >
              {c.in}
            </div>
            <span className="flex-1 text-[11px] text-text-secondary">{c.h}</span>
            <span className="text-[10px] font-bold text-primary">{c.r}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BrandActivity() {
  type Row = { ic: string; ib: string; t: string; s: string; badge: string|null; bBg?: string; bC?: string; ts?: string }
  const rows: Row[] = [
    { ic: '✅', ib: 'rgba(0,217,138,.15)',  t: 'Summer Glow approved', s: '45 new applicants',        badge: 'LIVE',   bBg: 'rgba(0,217,138,.12)',   bC: G  },
    { ic: '💰', ib: 'rgba(251,191,36,.15)', t: 'Payout processed',     s: '$3.2K to 12 creators',      badge: null,     ts: '2h ago'                       },
    { ic: '📋', ib: 'rgba(96,165,250,.15)', t: 'Brief draft saved',    s: 'Urban Fit Q3 campaign',      badge: 'DRAFT',  bBg: 'rgba(251,191,36,.12)',  bC: AM },
    { ic: '🚫', ib: 'rgba(248,113,113,.15)',t: 'Creator flagged',      s: '@crloco · policy violation', badge: 'REVIEW', bBg: 'rgba(248,113,113,.12)', bC: CO },
    { ic: '📦', ib: 'rgba(167,139,250,.15)',t: 'Sample sent',          s: 'NaturalKit SPF Kit',          badge: null,     ts: '5h ago'                       },
    { ic: '⭐', ib: 'rgba(251,191,36,.15)', t: 'Top performer',        s: '@jordanlux hit 50K views',    badge: null,     ts: '1d ago'                       },
  ]
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar gemBg={G} init="B" name="Brand Studio" pillBg="rgba(0,217,138,.1)" pillTxt={G} dotBg={G} label="LIVE" />
      <SL text="Recent activity" />
      <div className="flex flex-col gap-[3px] px-[14px]">
        {rows.map((r, i) => (
          <div
            key={i}
            id={`brand-activity-${i}`}
            className="flex items-center gap-2 rounded-[9px] border border-white/[0.06] bg-bg-card px-[9px] py-[7px]"
            style={{ opacity: 0, transform: 'translateX(-10px)' }}
          >
            <div
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] text-[15px]"
              style={{ background: r.ib }}
            >
              {r.ic}
            </div>
            <div className="min-w-0 flex-1">
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-semibold text-text-secondary">{r.t}</div>
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[9px] text-text-muted">{r.s}</div>
            </div>
            {r.badge
              ? <span className="shrink-0 rounded-[4px] px-[6px] py-[1px] text-[9px] font-bold" style={{ color: r.bC, background: r.bBg }}>{r.badge}</span>
              : <span className="shrink-0 text-[9px] text-text-muted">{r.ts}</span>
            }
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Creator screens ─────────────────────────────────────────────────────────── */

function CreatorReels() {
  const reels = [
    { in: 'JL', gr: 'linear-gradient(135deg,#00D98A,#00B872)', nm: '@jordanlux', tm: '2h ago', th: '🌞', ti: 'Summer Glow SPF',  pr: '🌿 NaturalKit · $67',  vw: '24K', ht: '1.8K', ea: '$420' },
    { in: 'SK', gr: 'linear-gradient(135deg,#a78bfa,#7c3aed)', nm: '@softkit',   tm: '5h ago', th: '🌿', ti: 'Morning Routine',  pr: '🏡 ZenHome · $45',     vw: '18K', ht: '2.1K', ea: '$290' },
    { in: 'MV', gr: 'linear-gradient(135deg,#fbbf24,#f59e0b)', nm: '@minivera',  tm: '1d ago', th: '⚡', ti: 'Fit Check',        pr: '⚡ FitFuel · $129',    vw: '31K', ht: '3.4K', ea: '$560' },
  ]
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar gemBg={PU} init="A" name="Creator Studio" pillBg="rgba(167,139,250,.1)" pillTxt={PU} dotBg={PU} label="CREATOR" />
      <SL text="My reels" />
      <div className="flex-1 overflow-hidden px-[14px]">
        <div className="pma-cscroll flex flex-col gap-1">
          {[...reels, ...reels].map((r, i) => (
            <div key={i} className="shrink-0 rounded-[13px] border border-[rgba(167,139,250,.1)] bg-bg-card px-[9px] py-[7px]">
              <div className="mb-1 flex items-center">
                <div
                  className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                  style={{ background: r.gr }}
                >
                  {r.in}
                </div>
                <span className="ml-1.5 text-[11px] font-bold text-text-secondary">{r.nm}</span>
                <span className="ml-auto text-[9px] text-text-muted">{r.tm}</span>
              </div>
              <div className="mb-1 flex h-[68px] gap-2">
                <div className="relative flex h-[68px] w-[62px] shrink-0 items-center justify-center rounded-[8px] bg-white/[0.05] text-[30px]">
                  {r.th}
                  <div className="absolute flex h-[17px] w-[17px] items-center justify-center rounded-full bg-white/90 text-[8px] text-black">▶</div>
                </div>
                <div className="flex flex-1 flex-col justify-center gap-1">
                  <span className="text-[11px] font-semibold text-text-secondary">{r.ti}</span>
                  <span className="self-start rounded-[5px] border border-primary/20 bg-primary/[0.08] px-1.5 py-[2px] text-[10px] font-bold text-primary">{r.pr}</span>
                </div>
              </div>
              <div className="flex items-center text-[10px] text-text-muted">
                <span>👁 <strong className="text-text-secondary">{r.vw}</strong></span>
                <span className="ml-[9px]">❤ <strong className="text-text-secondary">{r.ht}</strong></span>
                <span className="ml-auto font-extrabold text-primary">{r.ea}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CreatorBriefs() {
  const briefs = [
    { br: '🌿', bn: 'NaturalKit', st: 'Locked', sBg: 'rgba(0,217,138,.12)', sC: G,  hk: 'Create SPF lifestyle content for summer campaign',     cm: '$40–60/reel', cd: 'Weekly'    },
    { br: '☕', bn: 'BrewRoots',  st: 'Draft',  sBg: 'rgba(251,191,36,.12)', sC: AM, hk: 'Aesthetic morning routine featuring cold brew',          cm: '$35–50/reel', cd: '2× / week' },
    { br: '⚡', bn: 'FitFuel',   st: 'Locked', sBg: 'rgba(0,217,138,.12)', sC: G,  hk: 'High-energy gym content showcasing pre-workout formula', cm: '$50–80/reel', cd: '3× / week' },
  ]
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar gemBg={PU} init="A" name="Creator Studio" pillBg="rgba(251,191,36,.1)" pillTxt={AM} dotBg={AM} label="BRIEFS" />
      <SL text="Brand briefs for me" />
      <div className="flex flex-col gap-[3px] px-[14px]">
        {briefs.map((b, i) => (
          <div
            key={i}
            id={`creator-brief-${i}`}
            className="rounded-[10px] border border-[rgba(167,139,250,.1)] bg-bg-card px-[10px] py-[7px]"
            style={{ opacity: 0, transform: 'translateY(10px)' }}
          >
            <div className="mb-[3px] flex items-center">
              <div className="mr-1.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] bg-white/[0.05] text-[13px]">{b.br}</div>
              <span className="text-[11px] font-bold text-text-secondary">{b.bn}</span>
              <span className="ml-auto rounded-[4px] px-[6px] py-[1px] text-[9px] font-bold" style={{ color: b.sC, background: b.sBg }}>{b.st}</span>
            </div>
            <div className="mb-[3px] text-[10px] leading-[1.4] text-text-muted">{b.hk}</div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-primary">{b.cm}</span>
              <span className="text-[9px] text-text-muted">{b.cd}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CreatorEarnings() {
  const kpis = [
    { v: '$2,840', l: 'Total May', d: '+23%' },
    { v: '$189',   l: 'Avg/Reel',  d: '+15%' },
  ]
  const bh = [30, 45, 40, 55, 65, 72, 100]
  const bc = ['rgba(167,139,250,.40)','rgba(167,139,250,.48)','rgba(167,139,250,.52)','rgba(167,139,250,.58)','rgba(167,139,250,.64)','rgba(167,139,250,.70)', PU]
  const days = ['M','T','W','T','F','S','S']
  const brands = [
    { i: '🌿', n: 'NaturalKit', e: '$1,240' },
    { i: '⚡', n: 'FitFuel',    e: '$890'   },
    { i: '🏡', n: 'ZenHome',   e: '$710'   },
  ]
  return (
    <div className="flex flex-1 flex-col gap-[5px] overflow-hidden">
      <Topbar gemBg={PU} init="A" name="Creator Studio" pillBg="rgba(0,217,138,.1)" pillTxt={G} dotBg={G} label="MAY" />
      <SL text="Earnings overview" />
      <div className="grid shrink-0 grid-cols-2 gap-1 px-[14px]">
        {kpis.map((k, i) => (
          <div
            key={i}
            id={`creator-kpi-${i}`}
            className="rounded-[8px] border border-[rgba(167,139,250,.1)] bg-bg-card px-2 py-[6px]"
            style={{ opacity: 0, transform: 'translateY(8px)' }}
          >
            <div className="text-[15px] font-extrabold leading-[1] text-white">{k.v}</div>
            <div className="my-[2px] text-[8px] text-text-muted">{k.l}</div>
            <div className="text-[9px] font-bold text-primary">{k.d}</div>
          </div>
        ))}
      </div>
      <div
        id="creator-chart-card"
        className="mx-[14px] mt-[3px] shrink-0 rounded-[10px] border border-[rgba(167,139,250,.1)] bg-bg-card px-[10px] py-[7px]"
        style={{ opacity: 0, transform: 'translateY(8px)' }}
      >
        <div className="mb-[5px] text-[11px] font-bold text-text-secondary">Commission Trend</div>
        <div className="flex h-[58px] items-end gap-1">
          {bh.map((h, i) => (
            <div key={i} className="flex h-full flex-1 items-end">
              <div
                id={`creator-bar-${i}`}
                className="w-full rounded-[3px_3px_0_0]"
                style={{ height: `${h}%`, background: bc[i], transform: 'scaleY(0)', transformOrigin: 'bottom' }}
              />
            </div>
          ))}
        </div>
        <div className="mt-[3px] flex gap-1">
          {days.map((d, i) => (
            <div key={i} className="flex-1 text-center text-[8px] text-text-muted">{d}</div>
          ))}
        </div>
      </div>
      <div
        id="creator-earnings-card"
        className="mx-[14px] mt-[3px] shrink-0 rounded-[10px] border border-[rgba(167,139,250,.1)] bg-bg-card px-[10px] py-[7px]"
        style={{ opacity: 0, transform: 'translateY(8px)' }}
      >
        <div className="mb-1 text-[11px] font-bold text-text-secondary">Earnings by Brand</div>
        {brands.map((b, i) => (
          <div
            key={i}
            id={`creator-earnings-row-${i}`}
            className="flex items-center gap-[7px]"
            style={{ marginBottom: i < 2 ? 3 : 0, opacity: 0, transform: 'translateY(8px)' }}
          >
            <div className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[4px] bg-white/[0.05] text-[11px]">{b.i}</div>
            <span className="flex-1 text-[11px] text-text-secondary">{b.n}</span>
            <span className="text-[10px] font-bold" style={{ color: PU }}>{b.e}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CreatorPartners() {
  const partners = [
    { i: '🌿', n: 'NaturalKit', c: 'Skincare',  st: 'Active',  sBg: 'rgba(0,217,138,.12)',  sC: G,  re: '12', sa: '890', cm: '$1,240' },
    { i: '☕', n: 'BrewRoots',  c: 'Beverages', st: 'Active',  sBg: 'rgba(0,217,138,.12)',  sC: G,  re: '8',  sa: '450', cm: '$680'   },
    { i: '⚡', n: 'FitFuel',   c: 'Fitness',   st: 'Pending', sBg: 'rgba(251,191,36,.12)', sC: AM, re: '0',  sa: '—',   cm: '—'      },
    { i: '💎', n: 'Luxora',    c: 'Luxury',    st: 'Active',  sBg: 'rgba(0,217,138,.12)',  sC: G,  re: '5',  sa: '320', cm: '$510'   },
  ]
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar gemBg={PU} init="A" name="Creator Studio" pillBg="rgba(167,139,250,.1)" pillTxt={PU} dotBg={PU} label="LIVE" />
      <SL text="Brand partnerships" />
      <div className="flex flex-col gap-[3px] px-[14px]">
        {partners.map((p, i) => (
          <div
            key={i}
            id={`creator-partner-${i}`}
            className="rounded-[10px] border border-[rgba(167,139,250,.1)] bg-bg-card px-[10px] py-[7px]"
            style={{ opacity: 0, transform: 'translateX(10px)' }}
          >
            <div className="mb-[3px] flex items-center">
              <div className="mr-[7px] flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[7px] bg-white/[0.05] text-[16px]">{p.i}</div>
              <div className="flex-1">
                <div className="text-[11px] font-bold text-text-secondary">{p.n}</div>
                <div className="text-[8px] text-text-muted">{p.c}</div>
              </div>
              <span className="rounded-[4px] px-[6px] py-[1px] text-[9px] font-bold" style={{ color: p.sC, background: p.sBg }}>{p.st}</span>
            </div>
            <div className="flex gap-[10px]">
              <span className="text-[10px] text-text-muted"><strong className="text-text-secondary">{p.re}</strong> Reels</span>
              <span className="text-[10px] text-text-muted"><strong className="text-text-secondary">{p.sa}</strong> Sales</span>
              <span className="text-[10px] text-text-muted">Com: <strong className="text-text-secondary">{p.cm}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Phone frame ─────────────────────────────────────────────────────────────── */

function PhoneFrame({ side, border, active, screens, icons, labels }: {
  side: string; border: string; active: string
  screens: [ReactNode, ReactNode, ReactNode, ReactNode]
  icons:   [string, string, string, string]
  labels:  [string, string, string, string]
}) {
  const orb = side === 'creator' ? 'rgba(167,139,250,' : 'rgba(0,217,138,'
  return (
    <div
      className="relative overflow-hidden shrink-0 rounded-[44px]"
      style={{ width: 300, height: 572, background: DK, border: `2px solid ${border}` }}
    >
      {/* Mesh grid */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{ backgroundImage: 'linear-gradient(rgba(0,217,138,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,217,138,.022) 1px,transparent 1px)', backgroundSize: '18px 18px' }}
      />
      {/* Orbs */}
      <div className="pointer-events-none absolute z-[2] rounded-full" style={{ top: -50, left: -38, width: 152, height: 152, background: `${orb}0.07)` }} />
      <div className="pointer-events-none absolute z-[2] rounded-full" style={{ bottom: -38, right: -24, width: 114, height: 114, background: `${orb}0.05)` }} />
      {/* Notch */}
      <div className="absolute left-1/2 top-3 z-[30] h-[15px] w-[68px] -translate-x-1/2 rounded-[8px] bg-black" />
      {/* Screens */}
      {screens.map((scr, i) => (
        <div
          key={i}
          id={`${side}-screen-${i}`}
          className="absolute inset-0 z-[10] flex flex-col overflow-hidden box-border transition-opacity duration-[400ms] ease-[ease]"
          style={{ opacity: i === 0 ? 1 : 0, paddingTop: 36, paddingBottom: 62 }}
        >
          {scr}
        </div>
      ))}
      {/* Progress bar hidden — kept for JS timing */}
      <div className="hidden">
        <div id={`${side}-progress`} style={{ width: 0 }} />
      </div>
      {/* Navbar */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[25] flex justify-around border-t border-white/[0.06] px-2 pb-[11px] pt-[7px]"
        style={{ background: DK }}
      >
        {icons.map((ic, i) => (
          <div key={i} id={`${side}-tab-${i}`} className="flex cursor-pointer flex-col items-center gap-[3px] px-[5px]">
            <i
              id={`${side}-tab-icon-${i}`}
              className={`ti ${ic}`}
              style={{ fontSize: 20, color: i === 0 ? active : WM, transform: i === 0 ? 'scale(1.15)' : 'scale(1)' }}
            />
            <span id={`${side}-tab-label-${i}`} className="text-[8px] font-semibold" style={{ color: i === 0 ? active : WM }}>
              {labels[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main export ─────────────────────────────────────────────────────────────── */

export function PhoneMockupAnimation() {
  useEffect(() => {
    const INTERVAL = 5000

    function setup(side: 'brand' | 'creator') {
      let cur = 0
      let tick: ReturnType<typeof setInterval> | null = null
      const tos: ReturnType<typeof setTimeout>[] = []
      const ac = side === 'brand' ? G : PU

      const $ = (id: string) => document.getElementById(`${side}-${id}`)

      const clearTos = () => { while (tos.length) clearTimeout(tos.pop()!) }

      const resetBar = () => {
        if (tick) clearInterval(tick)
        const b = $('progress')
        if (!b) return
        b.style.transition = 'none'
        b.style.width = '0%'
      }

      const startBar = () => {
        const b = $('progress')
        if (!b) return
        const t0 = Date.now()
        tick = setInterval(() => {
          const p = Math.min((Date.now() - t0) / INTERVAL * 100, 100)
          b.style.width = p + '%'
          if (p >= 100) { clearInterval(tick!); go((cur + 1) % 4) }
        }, 50)
      }

      const hide = (e: HTMLElement | null, k: 'card'|'bar'|'sl'|'sr') => {
        if (!e) return
        e.style.transition = 'none'
        if (k !== 'bar') e.style.opacity = '0'
        if      (k === 'card') e.style.transform = 'translateY(10px)'
        else if (k === 'bar')  { e.style.transform = 'scaleY(0)'; e.style.transformOrigin = 'bottom' }
        else if (k === 'sl')   e.style.transform = 'translateX(-10px)'
        else                   e.style.transform = 'translateX(10px)'
      }

      const show = (e: HTMLElement | null, to: string, d: number, dur = 400) => {
        if (!e) return
        tos.push(setTimeout(() => {
          e.style.transition = `opacity ${dur}ms ease, transform ${dur}ms ease`
          e.style.opacity = '1'
          e.style.transform = to
        }, d))
      }

      const showBar = (e: HTMLElement | null, d: number) => {
        if (!e) return
        tos.push(setTimeout(() => {
          e.style.transition = 'transform 500ms cubic-bezier(0.34,1.2,0.64,1)'
          e.style.transform = 'scaleY(1)'
        }, d))
      }

      const resetScr = (n: number) => {
        if (n === 1) {
          const cnt = side === 'brand' ? 4 : 3
          for (let i = 0; i < cnt; i++) hide($(`brief-${i}`), 'card')
        } else if (n === 2) {
          const kc = side === 'brand' ? 3 : 2
          for (let i = 0; i < kc; i++) hide($(`kpi-${i}`), 'card')
          hide($('chart-card'), 'card')
          for (let i = 0; i < 7; i++) hide($(`bar-${i}`), 'bar')
          hide($(side === 'brand' ? 'creators-card' : 'earnings-card'), 'card')
          const rk = side === 'brand' ? 'creator-row' : 'earnings-row'
          for (let i = 0; i < 3; i++) hide($(`${rk}-${i}`), 'card')
        } else if (n === 3) {
          const cnt = side === 'brand' ? 6 : 4
          for (let i = 0; i < cnt; i++) hide($(side === 'brand' ? `activity-${i}` : `partner-${i}`), side === 'brand' ? 'sl' : 'sr')
        }
      }

      const runAnim = (n: number) => {
        if (n === 1) {
          const cnt = side === 'brand' ? 4 : 3
          const sg  = side === 'brand' ? 220 : 240
          for (let i = 0; i < cnt; i++) show($(`brief-${i}`), 'translateY(0)', 150 + i * sg)
        } else if (n === 2) {
          const kc = side === 'brand' ? 3 : 2
          const ks = side === 'brand' ? 120 : 140
          for (let i = 0; i < kc; i++) show($(`kpi-${i}`), 'translateY(0)', 200 + i * ks)
          show($('chart-card'), 'translateY(0)', 560)
          for (let i = 0; i < 7; i++) showBar($(`bar-${i}`), 600 + i * 80)
          show($(side === 'brand' ? 'creators-card' : 'earnings-card'), 'translateY(0)', 1000)
          const rk = side === 'brand' ? 'creator-row' : 'earnings-row'
          for (let i = 0; i < 3; i++) show($(`${rk}-${i}`), 'translateY(0)', 1080 + i * 180)
        } else if (n === 3) {
          const cnt = side === 'brand' ? 6 : 4
          const sg  = side === 'brand' ? 150 : 160
          for (let i = 0; i < cnt; i++) show($(side === 'brand' ? `activity-${i}` : `partner-${i}`), 'translateX(0)', 100 + i * sg, 380)
        }
      }

      function go(n: number) {
        clearTos()
        resetBar()
        resetScr(n)
        for (let i = 0; i < 4; i++) {
          const s = $(`screen-${i}`)
          if (s) s.style.opacity = i === n ? '1' : '0'
        }
        for (let i = 0; i < 4; i++) {
          const ic = $(`tab-icon-${i}`)
          const lb = $(`tab-label-${i}`)
          if (!ic || !lb) continue
          ic.style.transform = i === n ? 'scale(1.15)' : 'scale(1)'
          ic.style.color     = i === n ? ac : WM
          lb.style.color     = i === n ? ac : WM
        }
        runAnim(n)
        startBar()
        cur = n
      }

      for (let i = 0; i < 4; i++) {
        ;((idx) => {
          const tab = $(`tab-${idx}`)
          if (tab) tab.addEventListener('click', () => go(idx))
        })(i)
      }

      go(0)

      return () => {
        clearTos()
        if (tick) clearInterval(tick)
      }
    }

    const cb = setup('brand')
    const cc = setup('creator')
    return () => { cb(); cc() }
  }, [])

  return (
    <div className="flex items-center gap-5">
      <style>{STYLES}</style>
      <PhoneFrame
        side="brand"
        border="rgba(0,217,138,.28)"
        active={G}
        screens={[<BrandHome />, <BrandBriefs />, <BrandAnalytics />, <BrandActivity />]}
        icons={['ti-home', 'ti-file-text', 'ti-chart-bar', 'ti-bell']}
        labels={['Home', 'Briefs', 'Analytics', 'Activity']}
      />
      <div
        className="flex shrink-0 items-center justify-center rounded-full border border-white/[0.1] text-[9px] font-extrabold text-text-muted"
        style={{ width: 32, height: 32, background: DKC }}
      >
        vs
      </div>
      <PhoneFrame
        side="creator"
        border="rgba(167,139,250,.32)"
        active={PU}
        screens={[<CreatorReels />, <CreatorBriefs />, <CreatorEarnings />, <CreatorPartners />]}
        icons={['ti-video', 'ti-file-text', 'ti-coin', 'ti-users']}
        labels={['Reels', 'Briefs', 'Earnings', 'Partners']}
      />
    </div>
  )
}
