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

const G  = '#00D98A'
const DK = '#0A1612'
const DKC= '#132420'
const WS = '#B8E6D5'
const WM = '#7A9B8E'
const PU = '#a78bfa'
const AM = '#fbbf24'
const CO = '#f87171'
const BL = '#60a5fa'

/* ── Primitives ────────────────────────────────────── */

function Topbar({ gemBg, init, name, pillBg, pillTxt, dotBg, label }: {
  gemBg:string; init:string; name:string; pillBg:string; pillTxt:string; dotBg:string; label:string
}) {
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'0 14px', marginBottom:4, flexShrink:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <div style={{ width:26, height:26, borderRadius:6, background:gemBg, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{init}</span>
        </div>
        <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>{name}</span>
      </div>
      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4, background:pillBg, borderRadius:8, padding:'2px 8px' }}>
        <div className="pma-pdot" style={{ width:5, height:5, borderRadius:'50%', background:dotBg }} />
        <span style={{ fontSize:10, fontWeight:700, color:pillTxt }}>{label}</span>
      </div>
    </div>
  )
}

function SL({ text }: { text:string }) {
  return <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:WM, padding:'0 14px', marginBottom:3, flexShrink:0 }}>{text}</div>
}

/* ── Brand screens ─────────────────────────────────── */

function BrandHome() {
  const brands = [
    { e:'🌿', n:'NaturalKit', c:'Skincare',  ac:G  },
    { e:'💎', n:'Luxora',     c:'Luxury',    ac:PU },
    { e:'☕', n:'BrewRoots',  c:'Beverages', ac:AM },
    { e:'🏡', n:'ZenHome',   c:'Home',      ac:BL },
    { e:'⚡', n:'FitFuel',   c:'Fitness',   ac:CO },
  ]
  const prods = [
    { e:'👗', n:'Linen Set',   p:'$89'  },
    { e:'💄', n:'Velvet Lip',  p:'$34'  },
    { e:'🌿', n:'Green Serum', p:'$67'  },
    { e:'🧴', n:'Hydra Cream', p:'$45'  },
    { e:'👟', n:'Trail Pro',   p:'$129' },
    { e:'☕', n:'Cold Brew',   p:'$28'  },
  ]
  const stats = [
    { v:'$48.2K', l:'Revenue'   },
    { v:'1.2K',   l:'Creators'  },
    { v:'94%',    l:'Fulfilled' },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <Topbar gemBg={G} init="B" name="Brand Studio" pillBg="rgba(0,217,138,.1)" pillTxt={G} dotBg={G} label="LIVE" />
      <div style={{ height:100, overflow:'hidden', padding:'0 14px', marginBottom:3, flexShrink:0 }}>
        <div className="pma-bscroll">
          {[...brands,...brands].map((b,i) => (
            <div key={i} style={{ width:84, height:96, borderRadius:12, background:DKC, flexShrink:0, borderTop:`2px solid ${b.ac}`, padding:'8px 7px 6px', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
              <div style={{ width:34, height:34, borderRadius:8, background:'rgba(255,255,255,.05)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>{b.e}</div>
              <span style={{ fontSize:10, fontWeight:700, color:WS, textAlign:'center', lineHeight:1.2 }}>{b.n}</span>
              <span style={{ fontSize:8, color:WM }}>{b.c}</span>
            </div>
          ))}
        </div>
      </div>
      <SL text="Top products" />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, padding:'0 14px', marginBottom:3, flexShrink:0 }}>
        {prods.map((p,i) => (
          <div key={i} style={{ background:DKC, border:'1px solid rgba(255,255,255,.06)', borderRadius:8, padding:'5px 4px', display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
            <span style={{ fontSize:18 }}>{p.e}</span>
            <span style={{ fontSize:10, fontWeight:600, color:WS, textAlign:'center', lineHeight:1.2 }}>{p.n}</span>
            <span style={{ fontSize:10, fontWeight:700, color:G }}>{p.p}</span>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:4, padding:'0 14px', flexShrink:0 }}>
        {stats.map((s,i) => (
          <div key={i} style={{ flex:1, background:DKC, border:'1px solid rgba(255,255,255,.06)', borderRadius:8, padding:'5px 4px', textAlign:'center' }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>{s.v}</div>
            <div style={{ fontSize:8, color:WM }}>{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BrandBriefs() {
  const briefs = [
    { t:'Summer Glow', st:'Locked', sBg:'rgba(0,217,138,.12)', sC:G,  g:'Drive awareness for SPF range',     m:'50 creators · 3mo', roi:'4.2×' },
    { t:'Urban Fit Q3',st:'Draft',  sBg:'rgba(251,191,36,.12)',sC:AM, g:'Gym wear launch campaign',            m:'30 creators · $12K', roi:'—'   },
    { t:'Brew & Chill', st:'Locked', sBg:'rgba(0,217,138,.12)', sC:G, g:'Lifestyle content for cold brew',    m:'25 creators · 2mo', roi:'3.8×' },
    { t:'Home Stories', st:'Retired',sBg:'rgba(255,255,255,.06)',sC:WM,g:'Home decor showcase',               m:'40 creators · 4mo', roi:'2.1×' },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <Topbar gemBg={G} init="B" name="Brand Studio" pillBg="rgba(251,191,36,.1)" pillTxt={AM} dotBg={AM} label="BRIEFS" />
      <SL text="Campaign briefs" />
      <div style={{ display:'flex', flexDirection:'column', gap:3, padding:'0 14px' }}>
        {briefs.map((b,i) => (
          <div key={i} id={`brand-brief-${i}`} style={{ background:DKC, border:'1px solid rgba(255,255,255,.06)', borderRadius:10, padding:'7px 10px', opacity:0, transform:'translateY(10px)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:2 }}>
              <span style={{ fontSize:12, fontWeight:700, color:WS }}>{b.t}</span>
              <span style={{ fontSize:9, fontWeight:700, color:b.sC, background:b.sBg, padding:'1px 6px', borderRadius:4 }}>{b.st}</span>
            </div>
            <div style={{ fontSize:10, color:WM, marginBottom:3 }}>{b.g}</div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:9, color:WM }}>{b.m}</span>
              <span style={{ fontSize:11, fontWeight:800, color:G }}>{b.roi}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BrandAnalytics() {
  const kpis = [
    { v:'$124K',  l:'Revenue', d:'+18%' },
    { v:'8.4K',   l:'Orders',  d:'+12%' },
    { v:'$14.76', l:'AOV',     d:'+5%'  },
  ]
  const bh = [35,50,45,60,70,75,100]
  const bc = ['rgba(0,217,138,.35)','rgba(0,217,138,.42)','rgba(0,217,138,.48)','rgba(0,217,138,.52)','rgba(0,217,138,.58)','rgba(0,217,138,.65)',G]
  const days = ['M','T','W','T','F','S','S']
  const creators = [
    { in:'JL', gr:'linear-gradient(135deg,#00D98A,#00B872)', h:'@jordanlux', r:'$8.4K' },
    { in:'SK', gr:'linear-gradient(135deg,#a78bfa,#7c3aed)', h:'@softkit',   r:'$6.2K' },
    { in:'MV', gr:'linear-gradient(135deg,#fbbf24,#f59e0b)', h:'@minivera',  r:'$4.8K' },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', gap:5 }}>
      <Topbar gemBg={G} init="B" name="Brand Studio" pillBg="rgba(96,165,250,.1)" pillTxt={BL} dotBg={BL} label="30d" />
      <SL text="Analytics overview" />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, padding:'0 14px', flexShrink:0 }}>
        {kpis.map((k,i) => (
          <div key={i} id={`brand-kpi-${i}`} style={{ background:DKC, border:'1px solid rgba(255,255,255,.06)', borderRadius:8, padding:'6px 7px', opacity:0, transform:'translateY(8px)' }}>
            <div style={{ fontSize:14, fontWeight:800, color:'#fff', lineHeight:1 }}>{k.v}</div>
            <div style={{ fontSize:8, color:WM, margin:'2px 0' }}>{k.l}</div>
            <div style={{ fontSize:9, fontWeight:700, color:G }}>{k.d}</div>
          </div>
        ))}
      </div>
      <div id="brand-chart-card" style={{ margin:'3px 14px 0', background:DKC, border:'1px solid rgba(255,255,255,.06)', borderRadius:10, padding:'7px 10px', flexShrink:0, opacity:0, transform:'translateY(8px)' }}>
        <div style={{ fontSize:11, fontWeight:700, color:WS, marginBottom:5 }}>Weekly Revenue</div>
        <div style={{ display:'flex', alignItems:'flex-end', height:58, gap:4 }}>
          {bh.map((h,i) => (
            <div key={i} style={{ flex:1, display:'flex', alignItems:'flex-end', height:'100%' }}>
              <div id={`brand-bar-${i}`} style={{ width:'100%', height:`${h}%`, borderRadius:'3px 3px 0 0', background:bc[i], transform:'scaleY(0)', transformOrigin:'bottom' }} />
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:4, marginTop:3 }}>
          {days.map((d,i) => <div key={i} style={{ flex:1, textAlign:'center', fontSize:8, color:WM }}>{d}</div>)}
        </div>
      </div>
      <div id="brand-creators-card" style={{ margin:'3px 14px 0', background:DKC, border:'1px solid rgba(255,255,255,.06)', borderRadius:10, padding:'7px 10px', flexShrink:0, opacity:0, transform:'translateY(8px)' }}>
        <div style={{ fontSize:11, fontWeight:700, color:WS, marginBottom:4 }}>Top Creators</div>
        {creators.map((c,i) => (
          <div key={i} id={`brand-creator-row-${i}`} style={{ display:'flex', alignItems:'center', gap:7, marginBottom: i<2 ? 3 : 0, opacity:0, transform:'translateY(8px)' }}>
            <div style={{ width:22, height:22, borderRadius:'50%', background:c.gr, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700, color:'#fff', flexShrink:0 }}>{c.in}</div>
            <span style={{ fontSize:11, color:WS, flex:1 }}>{c.h}</span>
            <span style={{ fontSize:10, fontWeight:700, color:G }}>{c.r}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BrandActivity() {
  type Row = { ic:string; ib:string; t:string; s:string; badge:string|null; bBg?:string; bC?:string; ts?:string }
  const rows: Row[] = [
    { ic:'✅', ib:'rgba(0,217,138,.15)',  t:'Summer Glow approved', s:'45 new applicants',          badge:'LIVE',   bBg:'rgba(0,217,138,.12)',   bC:G  },
    { ic:'💰', ib:'rgba(251,191,36,.15)', t:'Payout processed',     s:'$3.2K to 12 creators',        badge:null,     ts:'2h ago'                       },
    { ic:'📋', ib:'rgba(96,165,250,.15)', t:'Brief draft saved',    s:'Urban Fit Q3 campaign',        badge:'DRAFT',  bBg:'rgba(251,191,36,.12)',  bC:AM },
    { ic:'🚫', ib:'rgba(248,113,113,.15)',t:'Creator flagged',      s:'@crloco · policy violation',   badge:'REVIEW', bBg:'rgba(248,113,113,.12)', bC:CO },
    { ic:'📦', ib:'rgba(167,139,250,.15)',t:'Sample sent',          s:'NaturalKit SPF Kit',            badge:null,     ts:'5h ago'                       },
    { ic:'⭐', ib:'rgba(251,191,36,.15)', t:'Top performer',        s:'@jordanlux hit 50K views',      badge:null,     ts:'1d ago'                       },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <Topbar gemBg={G} init="B" name="Brand Studio" pillBg="rgba(0,217,138,.1)" pillTxt={G} dotBg={G} label="LIVE" />
      <SL text="Recent activity" />
      <div style={{ display:'flex', flexDirection:'column', gap:3, padding:'0 14px' }}>
        {rows.map((r,i) => (
          <div key={i} id={`brand-activity-${i}`} style={{ display:'flex', alignItems:'center', gap:8, background:DKC, border:'1px solid rgba(255,255,255,.06)', borderRadius:9, padding:'7px 9px', opacity:0, transform:'translateX(-10px)' }}>
            <div style={{ width:30, height:30, borderRadius:8, background:r.ib, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>{r.ic}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, fontWeight:600, color:WS, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.t}</div>
              <div style={{ fontSize:9, color:WM, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.s}</div>
            </div>
            {r.badge
              ? <span style={{ fontSize:9, fontWeight:700, color:r.bC, background:r.bBg, padding:'1px 6px', borderRadius:4, flexShrink:0 }}>{r.badge}</span>
              : <span style={{ fontSize:9, color:WM, flexShrink:0 }}>{r.ts}</span>
            }
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Creator screens ───────────────────────────────── */

function CreatorReels() {
  const reels = [
    { in:'JL', gr:'linear-gradient(135deg,#00D98A,#00B872)', nm:'@jordanlux', tm:'2h ago', th:'🌞', ti:'Summer Glow SPF',  pr:'🌿 NaturalKit · $67',  vw:'24K', ht:'1.8K', ea:'$420' },
    { in:'SK', gr:'linear-gradient(135deg,#a78bfa,#7c3aed)', nm:'@softkit',   tm:'5h ago', th:'🌿', ti:'Morning Routine',  pr:'🏡 ZenHome · $45',     vw:'18K', ht:'2.1K', ea:'$290' },
    { in:'MV', gr:'linear-gradient(135deg,#fbbf24,#f59e0b)', nm:'@minivera',  tm:'1d ago', th:'⚡', ti:'Fit Check',        pr:'⚡ FitFuel · $129',    vw:'31K', ht:'3.4K', ea:'$560' },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <Topbar gemBg={PU} init="A" name="Creator Studio" pillBg="rgba(167,139,250,.1)" pillTxt={PU} dotBg={PU} label="CREATOR" />
      <SL text="My reels" />
      <div style={{ flex:1, overflow:'hidden', padding:'0 14px' }}>
        <div className="pma-cscroll" style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {[...reels,...reels].map((r,i) => (
            <div key={i} style={{ background:DKC, border:'1px solid rgba(167,139,250,.1)', borderRadius:13, padding:'7px 9px', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', marginBottom:4 }}>
                <div style={{ width:22, height:22, borderRadius:'50%', background:r.gr, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700, color:'#fff', flexShrink:0 }}>{r.in}</div>
                <span style={{ fontSize:11, fontWeight:700, color:WS, marginLeft:6 }}>{r.nm}</span>
                <span style={{ fontSize:9, color:WM, marginLeft:'auto' }}>{r.tm}</span>
              </div>
              <div style={{ display:'flex', gap:8, height:68, marginBottom:4 }}>
                <div style={{ width:62, height:68, borderRadius:8, background:'rgba(255,255,255,.05)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, position:'relative', flexShrink:0 }}>
                  {r.th}
                  <div style={{ position:'absolute', width:17, height:17, borderRadius:'50%', background:'rgba(255,255,255,.9)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:'#000' }}>▶</div>
                </div>
                <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', gap:4 }}>
                  <span style={{ fontSize:11, fontWeight:600, color:WS }}>{r.ti}</span>
                  <span style={{ fontSize:10, fontWeight:700, color:G, background:'rgba(0,217,138,.08)', border:'1px solid rgba(0,217,138,.2)', borderRadius:5, padding:'2px 6px', alignSelf:'flex-start' }}>{r.pr}</span>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', fontSize:10, color:WM }}>
                <span>👁 <strong style={{ color:WS }}>{r.vw}</strong></span>
                <span style={{ marginLeft:9 }}>❤ <strong style={{ color:WS }}>{r.ht}</strong></span>
                <span style={{ marginLeft:'auto', fontWeight:800, color:G }}>{r.ea}</span>
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
    { br:'🌿', bn:'NaturalKit', st:'Locked', sBg:'rgba(0,217,138,.12)', sC:G,  hk:'Create SPF lifestyle content for summer campaign',     cm:'$40–60/reel', cd:'Weekly'    },
    { br:'☕', bn:'BrewRoots',  st:'Draft',  sBg:'rgba(251,191,36,.12)', sC:AM, hk:'Aesthetic morning routine featuring cold brew',          cm:'$35–50/reel', cd:'2× / week' },
    { br:'⚡', bn:'FitFuel',   st:'Locked', sBg:'rgba(0,217,138,.12)', sC:G,  hk:'High-energy gym content showcasing pre-workout formula', cm:'$50–80/reel', cd:'3× / week' },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <Topbar gemBg={PU} init="A" name="Creator Studio" pillBg="rgba(251,191,36,.1)" pillTxt={AM} dotBg={AM} label="BRIEFS" />
      <SL text="Brand briefs for me" />
      <div style={{ display:'flex', flexDirection:'column', gap:3, padding:'0 14px' }}>
        {briefs.map((b,i) => (
          <div key={i} id={`creator-brief-${i}`} style={{ background:DKC, border:'1px solid rgba(167,139,250,.1)', borderRadius:10, padding:'7px 10px', opacity:0, transform:'translateY(10px)' }}>
            <div style={{ display:'flex', alignItems:'center', marginBottom:3 }}>
              <div style={{ width:22, height:22, borderRadius:5, background:'rgba(255,255,255,.05)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, marginRight:6, flexShrink:0 }}>{b.br}</div>
              <span style={{ fontSize:11, fontWeight:700, color:WS }}>{b.bn}</span>
              <span style={{ marginLeft:'auto', fontSize:9, fontWeight:700, color:b.sC, background:b.sBg, padding:'1px 6px', borderRadius:4 }}>{b.st}</span>
            </div>
            <div style={{ fontSize:10, color:WM, lineHeight:1.4, marginBottom:3 }}>{b.hk}</div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:11, fontWeight:700, color:G }}>{b.cm}</span>
              <span style={{ fontSize:9, color:WM }}>{b.cd}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CreatorEarnings() {
  const kpis = [
    { v:'$2,840', l:'Total May', d:'+23%' },
    { v:'$189',   l:'Avg/Reel',  d:'+15%' },
  ]
  const bh = [30,45,40,55,65,72,100]
  const bc = ['rgba(167,139,250,.40)','rgba(167,139,250,.48)','rgba(167,139,250,.52)','rgba(167,139,250,.58)','rgba(167,139,250,.64)','rgba(167,139,250,.70)',PU]
  const days = ['M','T','W','T','F','S','S']
  const brands = [
    { i:'🌿', n:'NaturalKit', e:'$1,240' },
    { i:'⚡', n:'FitFuel',    e:'$890'   },
    { i:'🏡', n:'ZenHome',   e:'$710'   },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', gap:5 }}>
      <Topbar gemBg={PU} init="A" name="Creator Studio" pillBg="rgba(0,217,138,.1)" pillTxt={G} dotBg={G} label="MAY" />
      <SL text="Earnings overview" />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, padding:'0 14px', flexShrink:0 }}>
        {kpis.map((k,i) => (
          <div key={i} id={`creator-kpi-${i}`} style={{ background:DKC, border:'1px solid rgba(167,139,250,.1)', borderRadius:8, padding:'6px 8px', opacity:0, transform:'translateY(8px)' }}>
            <div style={{ fontSize:15, fontWeight:800, color:'#fff', lineHeight:1 }}>{k.v}</div>
            <div style={{ fontSize:8, color:WM, margin:'2px 0' }}>{k.l}</div>
            <div style={{ fontSize:9, fontWeight:700, color:G }}>{k.d}</div>
          </div>
        ))}
      </div>
      <div id="creator-chart-card" style={{ margin:'3px 14px 0', background:DKC, border:'1px solid rgba(167,139,250,.1)', borderRadius:10, padding:'7px 10px', flexShrink:0, opacity:0, transform:'translateY(8px)' }}>
        <div style={{ fontSize:11, fontWeight:700, color:WS, marginBottom:5 }}>Commission Trend</div>
        <div style={{ display:'flex', alignItems:'flex-end', height:58, gap:4 }}>
          {bh.map((h,i) => (
            <div key={i} style={{ flex:1, display:'flex', alignItems:'flex-end', height:'100%' }}>
              <div id={`creator-bar-${i}`} style={{ width:'100%', height:`${h}%`, borderRadius:'3px 3px 0 0', background:bc[i], transform:'scaleY(0)', transformOrigin:'bottom' }} />
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:4, marginTop:3 }}>
          {days.map((d,i) => <div key={i} style={{ flex:1, textAlign:'center', fontSize:8, color:WM }}>{d}</div>)}
        </div>
      </div>
      <div id="creator-earnings-card" style={{ margin:'3px 14px 0', background:DKC, border:'1px solid rgba(167,139,250,.1)', borderRadius:10, padding:'7px 10px', flexShrink:0, opacity:0, transform:'translateY(8px)' }}>
        <div style={{ fontSize:11, fontWeight:700, color:WS, marginBottom:4 }}>Earnings by Brand</div>
        {brands.map((b,i) => (
          <div key={i} id={`creator-earnings-row-${i}`} style={{ display:'flex', alignItems:'center', gap:7, marginBottom: i<2 ? 3 : 0, opacity:0, transform:'translateY(8px)' }}>
            <div style={{ width:20, height:20, borderRadius:4, background:'rgba(255,255,255,.05)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, flexShrink:0 }}>{b.i}</div>
            <span style={{ fontSize:11, color:WS, flex:1 }}>{b.n}</span>
            <span style={{ fontSize:10, fontWeight:700, color:PU }}>{b.e}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CreatorPartners() {
  const partners = [
    { i:'🌿', n:'NaturalKit', c:'Skincare',  st:'Active',  sBg:'rgba(0,217,138,.12)',  sC:G,  re:'12', sa:'890', cm:'$1,240' },
    { i:'☕', n:'BrewRoots',  c:'Beverages', st:'Active',  sBg:'rgba(0,217,138,.12)',  sC:G,  re:'8',  sa:'450', cm:'$680'   },
    { i:'⚡', n:'FitFuel',   c:'Fitness',   st:'Pending', sBg:'rgba(251,191,36,.12)', sC:AM, re:'0',  sa:'—',   cm:'—'      },
    { i:'💎', n:'Luxora',    c:'Luxury',    st:'Active',  sBg:'rgba(0,217,138,.12)',  sC:G,  re:'5',  sa:'320', cm:'$510'   },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <Topbar gemBg={PU} init="A" name="Creator Studio" pillBg="rgba(167,139,250,.1)" pillTxt={PU} dotBg={PU} label="LIVE" />
      <SL text="Brand partnerships" />
      <div style={{ display:'flex', flexDirection:'column', gap:3, padding:'0 14px' }}>
        {partners.map((p,i) => (
          <div key={i} id={`creator-partner-${i}`} style={{ background:DKC, border:'1px solid rgba(167,139,250,.1)', borderRadius:10, padding:'7px 10px', opacity:0, transform:'translateX(10px)' }}>
            <div style={{ display:'flex', alignItems:'center', marginBottom:3 }}>
              <div style={{ width:28, height:28, borderRadius:7, background:'rgba(255,255,255,.05)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, marginRight:7, flexShrink:0 }}>{p.i}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, fontWeight:700, color:WS }}>{p.n}</div>
                <div style={{ fontSize:8, color:WM }}>{p.c}</div>
              </div>
              <span style={{ fontSize:9, fontWeight:700, color:p.sC, background:p.sBg, padding:'1px 6px', borderRadius:4 }}>{p.st}</span>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <span style={{ fontSize:10, color:WM }}><strong style={{ color:WS }}>{p.re}</strong> Reels</span>
              <span style={{ fontSize:10, color:WM }}><strong style={{ color:WS }}>{p.sa}</strong> Sales</span>
              <span style={{ fontSize:10, color:WM }}>Com: <strong style={{ color:WS }}>{p.cm}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Phone frame ───────────────────────────────────── */

function PhoneFrame({ side, border, active, screens, icons, labels }: {
  side: string; border: string; active: string
  screens: [ReactNode, ReactNode, ReactNode, ReactNode]
  icons:   [string, string, string, string]
  labels:  [string, string, string, string]
}) {
  const isCreator = side === 'creator'
  const orb = isCreator ? 'rgba(167,139,250,' : 'rgba(0,217,138,'
  return (
    <div style={{ width:300, height:572, borderRadius:44, background:DK, border:`2px solid ${border}`, position:'relative', overflow:'hidden', flexShrink:0 }}>
      {/* Mesh grid */}
      <div style={{ position:'absolute', inset:0, zIndex:1, pointerEvents:'none', backgroundImage:'linear-gradient(rgba(0,217,138,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,217,138,.022) 1px,transparent 1px)', backgroundSize:'18px 18px' }} />
      {/* Orbs */}
      <div style={{ position:'absolute', top:-50, left:-38, width:152, height:152, borderRadius:'50%', background:`${orb}0.07)`, zIndex:2, pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:-38, right:-24, width:114, height:114, borderRadius:'50%', background:`${orb}0.05)`, zIndex:2, pointerEvents:'none' }} />
      {/* Notch */}
      <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', width:68, height:15, borderRadius:8, background:'#000', zIndex:30 }} />
      {/* Screens */}
      {screens.map((scr, i) => (
        <div
          key={i}
          id={`${side}-screen-${i}`}
          style={{ position:'absolute', inset:0, zIndex:10, opacity: i === 0 ? 1 : 0, transition:'opacity 0.4s ease', overflow:'hidden', paddingTop:36, paddingBottom:62, display:'flex', flexDirection:'column', boxSizing:'border-box' }}
        >
          {scr}
        </div>
      ))}
      {/* Progress bar — hidden but kept for JS timing */}
      <div style={{ display:'none' }}>
        <div id={`${side}-progress`} style={{ width:0 }} />
      </div>
      {/* Navbar */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:25, background:DK, borderTop:'1px solid rgba(255,255,255,.06)', display:'flex', justifyContent:'space-around', padding:'7px 8px 11px' }}>
        {icons.map((ic, i) => (
          <div key={i} id={`${side}-tab-${i}`} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer', padding:'0 5px' }}>
            <i id={`${side}-tab-icon-${i}`} className={`ti ${ic}`} style={{ fontSize:20, color: i === 0 ? active : WM, transform: i === 0 ? 'scale(1.15)' : 'scale(1)' }} />
            <span id={`${side}-tab-label-${i}`} style={{ fontSize:8, fontWeight:600, color: i === 0 ? active : WM }}>{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main export ───────────────────────────────────── */

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
    <div style={{ display:'flex', alignItems:'center', gap:20 }}>
      <style>{STYLES}</style>
      <PhoneFrame
        side="brand"
        border="rgba(0,217,138,.28)"
        active={G}
        screens={[<BrandHome />, <BrandBriefs />, <BrandAnalytics />, <BrandActivity />]}
        icons={['ti-home', 'ti-file-text', 'ti-chart-bar', 'ti-bell']}
        labels={['Home', 'Briefs', 'Analytics', 'Activity']}
      />
      <div style={{ width:32, height:32, borderRadius:'50%', background:DKC, border:'1px solid rgba(255,255,255,.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:WM, flexShrink:0 }}>
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
