import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

const INTERVAL = 3500

/* ─── Phase 1 — Creator data ─────────────────────────────────────────────── */

const HOOKS = [
  { score: 94, tag: 'Top Pick', tagBg: 'rgba(0,217,138,0.12)', tagColor: 'var(--p)',  text: 'POV: Your skincare routine just got a serious upgrade — in 3 minutes.' },
  { score: 87, tag: 'Strong',   tagBg: 'rgba(251,191,36,0.12)', tagColor: '#fbbf24', text: "I tested NaturalKit Glow Serum for 30 days. Here's what actually changed." },
  { score: 78, tag: 'Good',     tagBg: 'rgba(96,165,250,0.12)', tagColor: '#60a5fa', text: 'The serum everyone in my DMs keeps asking about — a full review.' },
]

const KPIS = [
  { val: 'Rs 1.24L', label: 'Total Earnings',  delta: '↑ +42%',  pos: true  },
  { val: '382k',     label: 'Total Views',      delta: '↑ +28%',  pos: true  },
  { val: '4.8%',     label: 'Avg Conversion',   delta: '↑ +0.6%', pos: true  },
  { val: '2,140',    label: 'New Followers',     delta: '↑ +18%',  pos: true  },
]

const TOP_REELS = [
  { rank: '#1', emoji: '🌿', title: 'Morning glow routine',   meta: '24.1k · 5.2% CVR', bar: 95, earn: 'Rs 48.2k' },
  { rank: '#2', emoji: '👗', title: '5 looks — Luxora dress', meta: '18.6k · 4.8% CVR', bar: 73, earn: 'Rs 36.9k' },
  { rank: '#3', emoji: '☕', title: 'BrewRoots ritual',       meta: '15.3k · 3.9% CVR', bar: 55, earn: 'Rs 26.4k' },
  { rank: '#4', emoji: '🕯️', title: 'ZenHome candle',         meta: '12.8k · 3.1% CVR', bar: 40, earn: 'Rs 19.6k' },
]

const ACTIVITIES = [
  { icon: 'ti-file-description', dot: '#00D98A',  title: 'New Reel Briefing Ready',          sub: '94 hook score · 3 caption variants', badge: 'Studio',  badgeBg: 'rgba(0,217,138,0.1)',    badgeBd: 'rgba(0,217,138,0.3)',    badgeTc: 'var(--p)',  time: '2m ago' },
  { icon: 'ti-coin',             dot: '#fbbf24',  title: 'Commission — Rs 12,400',           sub: 'Glow Serum reel · NaturalKit',       badge: 'Payout',  badgeBg: 'rgba(251,191,36,0.1)',  badgeBd: 'rgba(251,191,36,0.3)',  badgeTc: '#fbbf24',   time: '1h ago' },
  { icon: 'ti-report-analytics', dot: '#60a5fa',  title: 'Post-Publish Report Ready',        sub: 'Reel #REL-0421 · 24k views',         badge: 'Report',  badgeBg: 'rgba(96,165,250,0.1)',  badgeBd: 'rgba(96,165,250,0.3)',  badgeTc: '#60a5fa',   time: '3h ago' },
  { icon: 'ti-rocket',           dot: '#00D98A',  title: 'Boost Offer — FREE · 29 min',      sub: 'Estimated reach: 42,000',            badge: 'Boost',   badgeBg: 'rgba(0,217,138,0.1)',    badgeBd: 'rgba(0,217,138,0.3)',    badgeTc: 'var(--p)',  time: '5m ago' },
  { icon: 'ti-target',           dot: '#a78bfa',  title: 'Story Arc Milestone Reached',      sub: 'Skincare Series · 5 of 10 reels',    badge: 'Arc',     badgeBg: 'rgba(167,139,250,0.1)', badgeBd: 'rgba(167,139,250,0.3)', badgeTc: '#a78bfa',   time: '1d ago' },
  { icon: 'ti-arrow-merge',      dot: '#f87171',  title: 'Stitch Suggestion — @radiance.pk', sub: '92% compatibility · Winter Glow',    badge: 'Stitch',  badgeBg: 'rgba(248,113,113,0.1)', badgeBd: 'rgba(248,113,113,0.3)', badgeTc: '#f87171',   time: '2d ago' },
]

const ARCS = [
  { title: 'Skincare Glow Series', state: 'Active', icon: 'ti-sparkles', theme: 'Natural Skincare Ritual', boost: '+12% boost', reached: 5, total: 8, earn: 'Rs 18,400' },
  { title: 'Winter Fashion Week',  state: 'Active', icon: 'ti-hanger',   theme: 'Cozy Outfit Styling',     boost: '+10% boost', reached: 3, total: 8, earn: 'Rs 11,200' },
  { title: 'Wellness Morning Arc', state: 'New',    icon: 'ti-sun',      theme: 'Daily Wellness Ritual',   boost: '+15% boost', reached: 0, total: 8, earn: 'Rs 0'      },
]

/* ─── component ──────────────────────────────────────────────────────────── */

export default function LoginOverviewWidget() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const pendingTimers: ReturnType<typeof setTimeout>[] = []
    let cycleTimer: ReturnType<typeof setTimeout> | null = null
    let heroIdx = 0
    let currentPhase: 'studio' | 'mobile' = 'studio'
    let gen = 0

    const $ = (sel: string, ctx: Element | Document = root) =>
      ctx.querySelector<HTMLElement>(sel)
    const $$ = (sel: string, ctx: Element | Document = root) =>
      Array.from(ctx.querySelectorAll<HTMLElement>(sel))

    function after(ms: number, fn: () => void) {
      const t = setTimeout(fn, ms)
      pendingTimers.push(t)
      return t
    }

    function cancelAll() {
      gen++
      pendingTimers.forEach(clearTimeout)
      pendingTimers.length = 0
      if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null }
    }

    function fadeOut(el: HTMLElement, dur: number, cb: () => void) {
      const myGen = gen
      const start = performance.now()
      function tick(ts: number) {
        if (gen !== myGen) return
        const p = Math.min((ts - start) / dur, 1)
        el.style.opacity = String(1 - p)
        if (p < 1) requestAnimationFrame(tick)
        else cb()
      }
      requestAnimationFrame(tick)
    }

    function fadeIn(el: HTMLElement, dur: number, fromY = 0, cb?: () => void) {
      const myGen = gen
      el.style.opacity = '0'
      el.style.transform = fromY !== 0 ? `translateY(${fromY}px)` : ''
      const start = performance.now()
      function tick(ts: number) {
        if (gen !== myGen) return
        const raw = Math.min((ts - start) / dur, 1)
        const ease = 1 - Math.pow(1 - raw, 3)
        el.style.opacity = String(ease)
        if (fromY !== 0) el.style.transform = `translateY(${Math.round((1 - ease) * fromY)}px)`
        if (raw < 1) requestAnimationFrame(tick)
        else { el.style.transform = ''; cb?.() }
      }
      requestAnimationFrame(tick)
    }

    function noTrans(el: HTMLElement) { el.style.transition = 'none' }

    /* ── reset helpers ── */
    function resetAllPanelElements() {
      $$('.hkc').forEach(c        => { noTrans(c); c.style.opacity = '0'; c.style.transform = 'translateY(14px)' })
      $$('.cap-card').forEach(c   => { noTrans(c); c.style.opacity = '0' })
      $$('.pt-card').forEach(c    => { noTrans(c); c.style.opacity = '0' })
      $$('.pt-bf').forEach(b      => { noTrans(b); b.style.width = '0%' })
      $$('.boost-card').forEach(c => { noTrans(c); c.style.opacity = '0' })
      $$('.kpi-card').forEach(c   => { noTrans(c); c.style.opacity = '0' })
      const cc = $('#chart-card'); if (cc) { noTrans(cc); cc.style.opacity = '0' }
      $$('.chart-bar').forEach(b        => { noTrans(b); b.style.transform = 'scaleY(0)' })
      $$('.chart-bar-label').forEach(l  => { noTrans(l); l.style.opacity = '0' })
      const trc = $('#top-reels-card'); if (trc) { noTrans(trc); trc.style.opacity = '0' }
      $$('.tr-row').forEach(r       => { noTrans(r); r.style.opacity = '0'; r.style.transform = 'translateY(8px)' })
      $$('.tr-bar-fill').forEach(b  => { noTrans(b); b.style.width = '0%' })
      $$('.act-row').forEach(r      => { noTrans(r); r.style.opacity = '0'; r.style.transform = 'translateX(-14px)' })
      const ah = $('#arc-hero'); if (ah) { noTrans(ah); ah.style.opacity = '0' }
      $$('.arc-card').forEach(c => { noTrans(c); c.style.opacity = '0'; c.style.transform = 'translateY(14px)' })
    }

    function resetPhase2() {
      heroIdx = 0
      const rail = $('#hero-rail')
      if (rail) { rail.style.transition = 'none'; rail.style.transform = 'translateX(0)' }
      const inner = $('#scroll-inner')
      if (inner) { inner.style.transition = 'none'; inner.style.transform = 'translateY(0)' }
      const reelsRail = $('#reels-rail')
      if (reelsRail) { reelsRail.style.transition = 'none'; reelsRail.style.transform = 'translateX(0)' }
      const overlay = $('#reels-overlay')
      if (overlay) { overlay.style.display = 'none'; overlay.style.opacity = '0' }
      const slider = $('#reels-slider')
      if (slider) { slider.style.transition = 'none'; slider.style.transform = 'translateY(0)' }
      $$('.reel-pb-fill').forEach(b => { noTrans(b); b.style.width = '0%' })
      $$('.reel-video').forEach(v  => { const vid = v as HTMLVideoElement; vid.muted = true; vid.pause(); vid.currentTime = 0 })
    }

    /* ── panel entrance animations ── */
    function animateReelStudio() {
      $$('.hkc').forEach((c, i) => {
        after(80 + i * 180, () => {
          c.style.transition = 'opacity 0.45s ease, transform 0.45s ease'
          c.style.opacity = '1'; c.style.transform = 'translateY(0)'
        })
      })
      after(620, () => {
        $$('.cap-card').forEach(c => { c.style.transition = 'opacity 0.4s ease'; c.style.opacity = '1' })
      })
      after(920, () => {
        $$('.pt-card').forEach(c => { c.style.transition = 'opacity 0.4s ease'; c.style.opacity = '1' })
        after(200, () => {
          $$('.pt-bf').forEach(b => {
            b.style.transition = 'width 0.7s ease'
            b.style.width = b.dataset.tw ?? '0%'
          })
        })
      })
      after(1200, () => {
        $$('.boost-card').forEach(c => { c.style.transition = 'opacity 0.5s ease'; c.style.opacity = '1' })
      })
    }

    function animateAnalytics() {
      $$('.kpi-card').forEach((c, i) => {
        after(100 + i * 110, () => { c.style.transition = 'opacity 0.4s ease'; c.style.opacity = '1' })
      })
      after(560, () => {
        const cc = $('#chart-card')
        if (cc) { cc.style.transition = 'opacity 0.4s ease'; cc.style.opacity = '1' }
        $$('.chart-bar').forEach((b, i) => {
          after(i * 80, () => {
            b.style.transition = 'transform 0.55s cubic-bezier(0.34,1.3,0.64,1)'
            b.style.transform = 'scaleY(1)'
          })
        })
        after(7 * 80 + 200, () => {
          $$('.chart-bar-label').forEach(l => { l.style.transition = 'opacity 0.3s ease'; l.style.opacity = '1' })
        })
      })
      after(1000, () => {
        const trc = $('#top-reels-card')
        if (trc) { trc.style.transition = 'opacity 0.4s ease'; trc.style.opacity = '1' }
        $$('.tr-row').forEach((r, i) => {
          after(i * 180, () => {
            r.style.transition = 'opacity 0.4s ease, transform 0.4s ease'
            r.style.opacity = '1'; r.style.transform = 'translateY(0)'
            after(200, () => {
              const fill = r.querySelector<HTMLElement>('.tr-bar-fill')
              if (fill) { fill.style.transition = 'width 0.7s ease'; fill.style.width = fill.dataset.tw ?? '0%' }
            })
          })
        })
      })
    }

    function animateActivity() {
      $$('.act-row').forEach((r, i) => {
        after(60 + i * 140, () => {
          r.style.transition = 'opacity 0.4s ease, transform 0.4s ease'
          r.style.opacity = '1'; r.style.transform = 'translateX(0)'
        })
      })
    }

    function animateStoryArcs() {
      const ah = $('#arc-hero')
      after(80, () => { if (ah) { ah.style.transition = 'opacity 0.5s ease'; ah.style.opacity = '1' } })
      $$('.arc-card').forEach((c, i) => {
        after(280 + i * 200, () => {
          c.style.transition = 'opacity 0.45s ease, transform 0.45s ease'
          c.style.opacity = '1'; c.style.transform = 'translateY(0)'
        })
      })
    }

    const ANIMATE = [animateReelStudio, animateAnalytics, animateActivity, animateStoryArcs]
    const LABELS  = ['Reel Studio', 'Analytics', 'Activity', 'Story Arcs']

    /* ── goTo ── */
    function goTo(n: number) {
      cancelAll()
      resetAllPanelElements()

      $$('.panel').forEach((p, i) => {
        p.style.opacity = i === n ? '1' : '0'
        p.style.pointerEvents = i === n ? 'auto' : 'none'
      })
      $$('.nav-tab').forEach((t, i) => {
        if (i === n) {
          t.style.background = 'rgba(0,217,138,0.1)'
          t.style.borderColor = 'rgba(0,217,138,0.25)'
          t.style.color = 'var(--p)'
        } else {
          t.style.background = 'transparent'
          t.style.borderColor = 'transparent'
          t.style.color = 'var(--tm)'
        }
      })
      $$('.dot-ind').forEach((d, i) => {
        d.style.width = i === n ? '18px' : '5px'
        d.style.background = i === n ? 'var(--p)' : 'rgba(0,217,138,0.2)'
      })

      const lbl  = $('#footer-label');  if (lbl)  lbl.textContent  = LABELS[n] ?? ''
      const hint = $('#footer-hint');   if (hint)  hint.textContent = 'Auto-cycling · 3.5s'

      ANIMATE[n]?.()

      if (n === 3) {
        after(INTERVAL - 400, () => { const h = $('#footer-hint'); if (h) h.textContent = 'Launching mobile view…' })
        cycleTimer = setTimeout(() => transitionToPhase2(), INTERVAL)
      } else {
        cycleTimer = setTimeout(() => goTo(n + 1), INTERVAL)
      }
    }

    /* ── phase transitions ── */
    function transitionToPhase2() {
      cancelAll()
      const ph1 = $('#ph1'); const ph2 = $('#ph2')
      if (!ph1 || !ph2) return
      fadeOut(ph1, 500, () => {
        ph1.style.display = 'none'
        resetPhase2()
        ph2.style.display = 'flex'
        currentPhase = 'mobile'
        setToggleActive('mobile')
        fadeIn(ph2, 600, 30, () => startHeroScroll())
      })
    }

    function transitionToPhase1() {
      cancelAll()
      $$('.reel-video').forEach(v => { const vid = v as HTMLVideoElement; vid.muted = true; vid.pause() })
      const ph1 = $('#ph1'); const ph2 = $('#ph2')
      if (!ph1 || !ph2) return
      fadeOut(ph2, 500, () => {
        ph2.style.display = 'none'
        ph1.style.display = 'block'
        currentPhase = 'studio'
        setToggleActive('studio')
        fadeIn(ph1, 600, -20, () => goTo(0))
      })
    }

    /* ── phase 2 scroll chain ── */
    function startHeroScroll() { after(600, scrollHero) }

    function scrollHero() {
      const rail = $('#hero-rail')
      if (!rail) return
      heroIdx++
      rail.style.transition = 'transform 0.85s cubic-bezier(0.4,0,0.2,1)'
      rail.style.transform = `translateX(-${heroIdx * 228}px)`
      if (heroIdx < 3) after(2000, scrollHero)
      else             after(900,  startVerticalScroll)
    }

    function startVerticalScroll() {
      const myGen = gen
      const outer = $('#scroll-outer'); const inner = $('#scroll-inner')
      if (!outer || !inner) return
      const dist = inner.scrollHeight - outer.offsetHeight
      if (dist <= 0) { after(800, startReelsGrid); return }
      const duration = dist * 18
      let vsStart = 0
      function step(ts: number) {
        if (gen !== myGen || !inner) return
        if (!vsStart) vsStart = ts
        const raw  = Math.min((ts - vsStart) / duration, 1)
        const ease = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2
        inner.style.transform = `translateY(-${Math.round(ease * dist)}px)`
        if (raw < 1) requestAnimationFrame(step)
        else after(800, startReelsGrid)
      }
      requestAnimationFrame(step)
    }

    function startReelsGrid() {
      const rail = $('#reels-rail')
      if (!rail) { after(200, openReelsView); return }
      rail.style.transition = 'transform 0.75s cubic-bezier(0.4,0,0.2,1)'
      rail.style.transform  = 'translateX(-138px)'
      after(1000, openReelsView)
    }

    function openReelsView() {
      const myGen = gen
      const overlay = $('#reels-overlay')
      if (!overlay) { after(9000, transitionToPhase1); return }
      overlay.style.display  = 'flex'
      overlay.style.opacity  = '0'
      const start = performance.now()
      function rFadeIn(ts: number) {
        if (gen !== myGen || !overlay) return
        const p = Math.min((ts - start) / 400, 1)
        overlay.style.opacity = String(p)
        if (p < 1) requestAnimationFrame(rFadeIn)
        else playReel(0)
      }
      requestAnimationFrame(rFadeIn)
    }

    function playReel(index: number) {
      const myGen = gen
      $$('.reel-video').forEach((v, i) => {
        const vid = v as HTMLVideoElement
        vid.muted = true
        if (i === index) { vid.currentTime = 0; vid.play().catch(() => {}) }
        else               vid.pause()
      })
      $$('.reel-pb-fill').forEach(b => { noTrans(b); b.style.width = '0%' })
      const fill = $$('.reel-pb-fill')[index] as HTMLElement | undefined
      if (fill) requestAnimationFrame(() => {
        if (gen !== myGen) return
        fill.style.transition = 'width 5s linear'
        fill.style.width = '100%'
      })

      after(5000, () => {
        if (index < 2) {
          const slider = $('#reels-slider')
          if (slider) {
            slider.style.transition = 'transform 0.65s cubic-bezier(0.4,0,0.2,1)'
            slider.style.transform  = `translateY(-${(index + 1) * 580}px)`
          }
          after(350, () => playReel(index + 1))
        } else {
          const overlay2 = $('#reels-overlay')
          if (!overlay2) { transitionToPhase1(); return }
          const start2 = performance.now()
          function rFadeOut(ts: number) {
            if (gen !== myGen || !overlay2) return
            const p = Math.min((ts - start2) / 400, 1)
            overlay2.style.opacity = String(1 - p)
            if (p < 1) requestAnimationFrame(rFadeOut)
            else transitionToPhase1()
          }
          requestAnimationFrame(rFadeOut)
        }
      })
    }

    /* ── toggle active state ── */
    function setToggleActive(phase: 'studio' | 'mobile') {
      const btnStudio = document.getElementById('toggle-studio')
      const btnMobile = document.getElementById('toggle-mobile')
      const lblStudio = document.getElementById('toggle-studio-label')
      const lblMobile = document.getElementById('toggle-mobile-label')
      const dotStudio = document.getElementById('toggle-studio-dot')
      const dotMobile = document.getElementById('toggle-mobile-dot')
      if (!btnStudio || !btnMobile || !lblStudio || !lblMobile) return

      if (phase === 'studio') {
        Object.assign(btnStudio.style, { background: 'rgba(0,217,138,0.15)', color: '#00D98A', padding: '6px 16px' })
        if (dotStudio) Object.assign(dotStudio.style, { width: '0px', opacity: '0' })
        Object.assign(lblStudio.style, { maxWidth: '120px', opacity: '1' })
        Object.assign(btnMobile.style, { background: 'transparent', color: '#7A9B8E', padding: '6px 6px' })
        if (dotMobile) Object.assign(dotMobile.style, { width: '8px', opacity: '1', background: '#7A9B8E' })
        Object.assign(lblMobile.style, { maxWidth: '0px', opacity: '0' })
      } else {
        Object.assign(btnMobile.style, { background: 'rgba(0,217,138,0.15)', color: '#00D98A', padding: '6px 16px' })
        if (dotMobile) Object.assign(dotMobile.style, { width: '0px', opacity: '0' })
        Object.assign(lblMobile.style, { maxWidth: '120px', opacity: '1' })
        Object.assign(btnStudio.style, { background: 'transparent', color: '#7A9B8E', padding: '6px 6px' })
        if (dotStudio) Object.assign(dotStudio.style, { width: '8px', opacity: '1', background: '#7A9B8E' })
        Object.assign(lblStudio.style, { maxWidth: '0px', opacity: '0' })
      }
    }

    /* ── nav tab clicks ── */
    $$('.nav-tab').forEach((t, i) => t.addEventListener('click', () => goTo(i)))

    /* ── toggle clicks ── */
    const btnStudio = document.getElementById('toggle-studio')
    const btnMobile = document.getElementById('toggle-mobile')
    function handleStudioClick() { if (currentPhase !== 'studio') transitionToPhase1() }
    function handleMobileClick() { if (currentPhase !== 'mobile') transitionToPhase2() }
    btnStudio?.addEventListener('click', handleStudioClick)
    btnMobile?.addEventListener('click', handleMobileClick)

    /* ── kick off ── */
    const ph2El = $('#ph2'); if (ph2El) ph2El.style.display = 'none'
    setToggleActive('studio')
    goTo(0)

    return () => {
      cancelAll()
      btnStudio?.removeEventListener('click', handleStudioClick)
      btnMobile?.removeEventListener('click', handleMobileClick)
    }
  }, [])

  /* ── chart data ── */
  const bars = [
    { h: 38,  day: 'W1' }, { h: 55,  day: 'W2' }, { h: 48,  day: 'W3' },
    { h: 72,  day: 'W4' }, { h: 65,  day: 'W5' }, { h: 88,  day: 'W6' },
    { h: 100, day: 'W7' },
  ]
  const barColors = [
    'rgba(0,217,138,0.28)', 'rgba(0,217,138,0.36)', 'rgba(0,217,138,0.42)',
    'rgba(0,217,138,0.50)', 'rgba(0,217,138,0.58)', 'rgba(0,217,138,0.68)',
    'linear-gradient(180deg,#00FFA3,#00D98A)',
  ]

  /* ═══════════════════════════════ JSX ═══════════════════════════════════ */
  return (
    <div ref={rootRef} className="w-full flex flex-col items-center" style={{ fontFamily: 'inherit' }}>
      <style>{`
        .bs-root {
          --p:  #00D98A; --pd: #00B872; --pl: #00FFA3;
          --bg: #0A1612; --bgc:#132420; --bge:#1A332C;
          --tp: #ffffff; --ts: #B8E6D5; --tm: #7A9B8E;
          --bp: rgba(0,217,138,0.2); --bs: rgba(184,230,213,0.1);
          --am: #fbbf24; --co: #f87171; --bl: #60a5fa; --pu: #a78bfa;
        }
        @keyframes pingDot {
          0%,100% { transform:scale(1);   opacity:1   }
          50%     { transform:scale(1.5); opacity:0.4 }
        }
      `}</style>

      {/* ════════════════ PHASE 1 — Creator Studio ════════════════ */}
      <div id="ph1" className="bs-root block w-full">
        <div
          className="rounded-[20px] overflow-hidden relative border-[1.5px] border-[rgba(0,217,138,0.28)] bg-[#0A1612]"
          style={{
            backgroundImage: 'linear-gradient(rgba(0,217,138,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,217,138,0.022) 1px,transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        >
          {/* ambient orbs */}
          <div className="absolute -top-10 -right-10 w-60 h-60 rounded-full pointer-events-none" style={{ background: 'rgba(0,217,138,0.05)' }} />
          <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full pointer-events-none" style={{ background: 'rgba(0,255,163,0.03)' }} />

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[rgba(0,217,138,0.08)] relative z-[3]">
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-[13px] flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#00D98A,#00B872)', color: 'var(--bg)' }}
              >C</div>
              <div>
                <div
                  className="text-sm font-extrabold inline-block"
                  style={{ background: 'linear-gradient(135deg,#fff 0%,#00D98A 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
                >StyleMint</div>
                <div className="text-[9px]" style={{ color: 'var(--tm)' }}>Creator Studio</div>
              </div>
            </div>
            <div className="border rounded-[10px] px-2.5 py-1 flex items-center gap-1.5" style={{ background: 'rgba(0,217,138,0.1)', borderColor: 'rgba(0,217,138,0.25)' }}>
              <div className="w-[5px] h-[5px] rounded-full" style={{ background: 'var(--p)', animation: 'pingDot 1.4s infinite' }} />
              <span className="text-[9px] font-bold" style={{ color: 'var(--p)' }}>LIVE</span>
            </div>
          </div>

          {/* Nav Tabs */}
          <div className="flex gap-1.5 px-5 pt-2.5 relative z-[3]">
            {[
              { icon: 'ti-video',      label: 'Reel Studio' },
              { icon: 'ti-chart-line', label: 'Analytics'   },
              { icon: 'ti-activity',   label: 'Activity'    },
              { icon: 'ti-sparkles',   label: 'Story Arcs'  },
            ].map((t, i) => (
              <button
                key={i}
                className="nav-tab px-3.5 py-1.5 rounded-[10px] text-[10px] font-bold border border-transparent bg-transparent cursor-pointer flex items-center gap-[5px] transition-all duration-300"
                style={{ color: 'var(--tm)' }}
              >
                <i className={`ti ${t.icon} text-[12px]`} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="relative min-h-[300px] px-5 pt-[14px] pb-[18px] z-[3]">

            {/* ── Panel 0 — Reel Studio ── */}
            <div className="panel absolute inset-x-5 top-[14px] bottom-[18px] opacity-0 pointer-events-none">
              <div className="flex justify-between mb-2.5">
                <span className="text-[9px] font-bold tracking-[2.5px] uppercase" style={{ color: 'var(--tm)' }}>Hook Intelligence</span>
                <span className="text-[9px] font-bold" style={{ color: 'var(--p)' }}>AI-Powered</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {/* Left: hook cards */}
                <div className="flex flex-col gap-2">
                  {HOOKS.map((h, i) => (
                    <div
                      key={i}
                      className="hkc rounded-[14px] p-3 relative overflow-hidden"
                      style={{ background: 'var(--bgc)', border: '1px solid var(--bs)', opacity: 0, transform: 'translateY(14px)' }}
                    >
                      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(0,217,138,0.4),transparent)' }} />
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 rounded-[5px] px-1.5 py-[2px]" style={{ background: 'rgba(0,217,138,0.1)', border: '1px solid rgba(0,217,138,0.2)' }}>
                          <span className="text-[11px] font-extrabold" style={{ color: 'var(--p)' }}>{h.score}</span>
                          <span className="text-[7px]" style={{ color: 'var(--tm)' }}>Score</span>
                        </div>
                        <span
                          className="text-[7px] font-bold px-1.5 py-[2px] rounded-[4px]"
                          style={{ background: h.tagBg, color: h.tagColor, border: `1px solid ${h.tagBg}` }}
                        >{h.tag}</span>
                      </div>
                      <p className="text-[8px] leading-[1.5] m-0" style={{ color: 'var(--ts)' }}>{h.text}</p>
                    </div>
                  ))}
                </div>
                {/* Right: caption + post times + boost */}
                <div className="flex flex-col gap-2">
                  {/* Caption Variants */}
                  <div className="cap-card rounded-[14px] p-3 relative overflow-hidden" style={{ background: 'var(--bgc)', border: '1px solid var(--bs)', opacity: 0 }}>
                    <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(0,217,138,0.4),transparent)' }} />
                    <div className="text-[7px] font-bold uppercase tracking-[1.5px] mb-2" style={{ color: 'var(--tm)' }}>Caption Variants</div>
                    {[
                      { tone: 'Casual',      text: 'Okay but this serum is genuinely doing something 🌿 link in bio' },
                      { tone: 'Educational', text: 'Breaking down why Glycolic Acid works — the product I swear by.' },
                    ].map((cap, i) => (
                      <div key={i} className="px-[7px] py-1 rounded-[6px] mb-[3px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="text-[7px] font-bold mb-0.5" style={{ color: 'var(--p)' }}>{cap.tone}</div>
                        <div className="text-[7px] leading-[1.4]" style={{ color: 'var(--ts)' }}>{cap.text}</div>
                      </div>
                    ))}
                  </div>
                  {/* Best Post Times */}
                  <div className="pt-card rounded-[14px] p-3 relative overflow-hidden" style={{ background: 'var(--bgc)', border: '1px solid var(--bs)', opacity: 0 }}>
                    <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(0,217,138,0.4),transparent)' }} />
                    <div className="text-[7px] font-bold uppercase tracking-[1.5px] mb-2" style={{ color: 'var(--tm)' }}>Best Post Times</div>
                    {[
                      { label: 'Tue 7pm', pct: 92 },
                      { label: 'Thu 8pm', pct: 85 },
                      { label: 'Sun 6pm', pct: 74 },
                    ].map((pt, i) => (
                      <div key={i} className="flex items-center gap-2 mb-[3px]">
                        <span className="text-[9px] font-extrabold min-w-[44px]" style={{ color: 'var(--tp)' }}>{pt.label}</span>
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <div
                            className="pt-bf h-full rounded-full"
                            data-tw={`${pt.pct}%`}
                            style={{ width: '0%', background: 'linear-gradient(90deg,var(--p),var(--pl))' }}
                          />
                        </div>
                        <span className="text-[8px] font-bold" style={{ color: 'var(--p)' }}>{pt.pct}%</span>
                      </div>
                    ))}
                  </div>
                  {/* Boost Offer */}
                  <div
                    className="boost-card rounded-[14px] p-3 relative overflow-hidden"
                    style={{ background: 'linear-gradient(135deg,rgba(0,217,138,0.08),rgba(0,184,114,0.04))', border: '1px solid rgba(0,217,138,0.18)', opacity: 0 }}
                  >
                    <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(0,217,138,0.4),transparent)' }} />
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1 mb-0.5">
                          <i className="ti ti-bolt text-[9px]" style={{ color: 'var(--p)' }} />
                          <span className="text-[8px] font-extrabold" style={{ color: 'var(--tp)' }}>Boost Offer — FREE</span>
                        </div>
                        <div className="text-[7px]" style={{ color: 'var(--tm)' }}>Estimated reach: 42,000</div>
                      </div>
                      <button
                        className="rounded-[7px] px-2.5 py-1 text-[8px] font-extrabold border-none cursor-pointer"
                        style={{ background: 'linear-gradient(135deg,var(--p),var(--pd))', color: 'var(--bg)' }}
                      >Accept</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Panel 1 — Analytics ── */}
            <div className="panel absolute inset-x-5 top-[14px] bottom-[18px] opacity-0 pointer-events-none">
              <div className="flex justify-between mb-2.5">
                <span className="text-[9px] font-bold tracking-[2.5px] uppercase" style={{ color: 'var(--tm)' }}>Performance</span>
                <span className="text-[9px] font-bold" style={{ color: 'var(--p)' }}>Last 30 days</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {/* Left: KPIs + chart */}
                <div className="flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    {KPIS.map((k, i) => (
                      <div key={i} className="kpi-card rounded-xl p-2.5 opacity-0 relative overflow-hidden" style={{ background: 'var(--bgc)', border: '1px solid var(--bs)' }}>
                        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(0,217,138,0.5),transparent)' }} />
                        <div className="text-base font-extrabold leading-none" style={{ color: 'var(--tp)' }}>{k.val}</div>
                        <div className="text-[8px] my-0.5" style={{ color: 'var(--tm)' }}>{k.label}</div>
                        <div className={cn('text-[8px] font-bold', k.pos ? 'text-[#34d399]' : 'text-[#f87171]')}>{k.delta}</div>
                      </div>
                    ))}
                  </div>
                  {/* Earnings chart */}
                  <div id="chart-card" className="rounded-xl p-3 opacity-0" style={{ background: 'var(--bgc)', border: '1px solid var(--bs)' }}>
                    <div className="flex justify-between mb-2">
                      <span className="text-[10px] font-bold" style={{ color: 'var(--ts)' }}>Earnings Trend</span>
                      <span className="text-[8px]" style={{ color: 'var(--tm)' }}>Last 7 weeks</span>
                    </div>
                    <div className="flex gap-[3px] h-[68px] items-end">
                      {bars.map((b, i) => (
                        <div key={i} className="flex-1 relative h-full flex flex-col justify-end">
                          {b.h === 100 && (
                            <div className="chart-bar-label absolute -top-[14px] left-1/2 -translate-x-1/2 opacity-0 whitespace-nowrap">
                              <span className="text-[6px] font-bold" style={{ color: 'var(--p)' }}>Peak</span>
                            </div>
                          )}
                          <div
                            className="chart-bar w-full rounded-t-[3px] relative overflow-hidden"
                            style={{
                              height: `${b.h}%`,
                              background: barColors[i],
                              transformOrigin: 'bottom',
                              transform: 'scaleY(0)',
                              boxShadow: b.h === 100 ? '0 0 8px rgba(0,217,138,0.5)' : undefined,
                            }}
                          >
                            <div className="absolute bottom-0 left-0 right-0 h-[40%] opacity-30" style={{ background: 'var(--p)' }} />
                            {b.h === 100 && <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(0,255,163,0.25),transparent)' }} />}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-[3px] mt-1">
                      {bars.map((b, i) => (
                        <div key={i} className="flex-1 text-center text-[7px]" style={{ color: b.h === 100 ? 'var(--p)' : 'var(--tm)', fontWeight: b.h === 100 ? 700 : 400 }}>{b.day}</div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Right: Top Reels */}
                <div id="top-reels-card" className="rounded-xl p-3 opacity-0" style={{ background: 'var(--bgc)', border: '1px solid var(--bs)' }}>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <i className="ti ti-crown text-[9px]" style={{ color: 'var(--p)' }} />
                    <span className="text-[10px] font-bold" style={{ color: 'var(--ts)' }}>Top Reels by Earnings</span>
                  </div>
                  {TOP_REELS.map((r, i) => (
                    <div key={i} className="tr-row mb-2.5 opacity-0" style={{ transform: 'translateY(8px)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[8px] font-extrabold w-3.5" style={{ color: 'var(--tm)' }}>{r.rank}</span>
                        <div className="w-6 h-6 rounded-[4px] flex items-center justify-center text-[13px] flex-shrink-0" style={{ background: 'var(--bge)', border: '1px solid var(--bs)' }}>{r.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[9px] font-bold truncate" style={{ color: 'var(--tp)' }}>{r.title}</div>
                          <div className="text-[7px]" style={{ color: 'var(--tm)' }}>{r.meta}</div>
                        </div>
                      </div>
                      <div className="ml-[22px] flex items-center gap-2">
                        <div className="w-[48px] h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <div
                            className="tr-bar-fill h-full rounded-full w-0"
                            data-tw={`${r.bar}%`}
                            style={{ background: 'linear-gradient(90deg,var(--p),var(--pl))' }}
                          />
                        </div>
                        <span className="text-[9px] font-extrabold" style={{ color: 'var(--p)' }}>{r.earn}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Panel 2 — Activity ── */}
            <div className="panel absolute inset-x-5 top-[14px] bottom-[18px] opacity-0 pointer-events-none">
              <div className="flex justify-between mb-2.5">
                <span className="text-[9px] font-bold tracking-[2.5px] uppercase" style={{ color: 'var(--tm)' }}>Recent Activity</span>
                <span className="text-[9px] font-bold" style={{ color: 'var(--p)' }}>Live Feed</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ACTIVITIES.map((a, i) => (
                  <div
                    key={i}
                    className="act-row flex items-start gap-2.5 rounded-xl p-2.5"
                    style={{ background: 'var(--bgc)', border: '1px solid var(--bs)', opacity: 0, transform: 'translateX(-14px)' }}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-7 h-7 rounded-[9px] flex items-center justify-center" style={{ background: a.badgeBg }}>
                        <i className={`ti ${a.icon} text-sm`} style={{ color: a.badgeTc }} />
                      </div>
                      <div className="absolute -top-[3px] -right-[3px] w-2 h-2 rounded-full border-2" style={{ background: a.dot, borderColor: 'var(--bg)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-bold mb-[1px] truncate" style={{ color: 'var(--tp)' }}>{a.title}</div>
                      <div className="text-[8px] mb-1" style={{ color: 'var(--tm)' }}>{a.sub}</div>
                      <div className="flex justify-between items-center">
                        <span
                          className="text-[7px] font-bold px-1.5 py-[2px] rounded"
                          style={{ background: a.badgeBg, border: `1px solid ${a.badgeBd}`, color: a.badgeTc }}
                        >{a.badge}</span>
                        <span className="text-[7px]" style={{ color: 'var(--tm)' }}>{a.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Panel 3 — Story Arcs ── */}
            <div className="panel absolute inset-x-5 top-[14px] bottom-[18px] opacity-0 pointer-events-none">
              <div className="flex justify-between mb-2.5">
                <span className="text-[9px] font-bold tracking-[2.5px] uppercase" style={{ color: 'var(--tm)' }}>Story Arcs</span>
                <span className="text-[9px] font-bold" style={{ color: 'var(--p)' }}>3 Active</span>
              </div>
              {/* Arc hero */}
              <div
                id="arc-hero"
                className="rounded-[14px] p-3.5 mb-2.5 flex items-center justify-between opacity-0 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg,rgba(0,217,138,0.1),rgba(0,184,114,0.04))', border: '1px solid rgba(0,217,138,0.18)' }}
              >
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(0,217,138,0.4),transparent)' }} />
                <div>
                  <div className="flex items-center gap-1 mb-[3px]">
                    <i className="ti ti-bolt text-[9px]" style={{ color: 'var(--p)' }} />
                    <span className="text-[8px] font-bold tracking-[2px] uppercase" style={{ color: 'var(--p)' }}>Commission Boost</span>
                  </div>
                  <div className="text-sm font-extrabold mb-0.5" style={{ color: 'var(--tp)' }}>Complete Your Arc, Earn More</div>
                  <div className="text-[9px]" style={{ color: 'var(--tm)' }}>Up to +15% commission on arc reels</div>
                </div>
                <div className="flex items-center gap-1 rounded-full px-3 py-1" style={{ background: 'rgba(0,217,138,0.12)', border: '1px solid rgba(0,217,138,0.25)' }}>
                  <i className="ti ti-trending-up text-[9px]" style={{ color: 'var(--p)' }} />
                  <span className="text-[8px] font-bold whitespace-nowrap" style={{ color: 'var(--p)' }}>+15% boost</span>
                </div>
              </div>
              {/* Arc cards */}
              <div className="grid grid-cols-3 gap-2.5">
                {ARCS.map((arc, i) => (
                  <div
                    key={i}
                    className="arc-card rounded-[13px] p-3 relative overflow-hidden"
                    style={{ background: 'var(--bgc)', border: '1px solid var(--bs)', opacity: 0, transform: 'translateY(14px)' }}
                  >
                    <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(0,217,138,0.25),transparent)' }} />
                    <div className="flex items-start justify-between mb-1.5">
                      <span className="text-[9px] font-bold flex-1 leading-[1.3]" style={{ color: 'var(--tp)' }}>{arc.title}</span>
                      <span
                        className="text-[7px] font-bold px-1.5 py-[2px] rounded-[5px] ml-1 whitespace-nowrap flex-shrink-0"
                        style={{
                          background: arc.state === 'Active' ? 'rgba(0,217,138,0.12)' : 'rgba(96,165,250,0.1)',
                          color:      arc.state === 'Active' ? 'var(--p)' : '#60a5fa',
                          border: `1px solid ${arc.state === 'Active' ? 'rgba(0,217,138,0.2)' : 'rgba(96,165,250,0.2)'}`,
                        }}
                      >{arc.state}</span>
                    </div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <i className={`ti ${arc.icon} text-[8px]`} style={{ color: 'var(--tm)' }} />
                      <span className="text-[7px]" style={{ color: 'var(--tm)' }}>{arc.theme}</span>
                    </div>
                    <div
                      className="text-[7px] font-bold mb-2"
                      style={{ background: 'linear-gradient(90deg,var(--p),var(--pl))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
                    >{arc.boost}</div>
                    <div className="flex gap-[3px] mb-2">
                      {Array.from({ length: arc.total }, (_, j) => (
                        <span
                          key={j}
                          className="w-[6px] h-[6px] rounded-full"
                          style={{
                            background:  j < arc.reached ? 'var(--p)' : 'rgba(255,255,255,0.1)',
                            border:      j < arc.reached ? 'none'      : '1px solid rgba(255,255,255,0.15)',
                            boxShadow:   j < arc.reached ? '0 0 4px rgba(0,217,138,0.5)' : 'none',
                          }}
                        />
                      ))}
                    </div>
                    <div className="text-[9px] font-extrabold" style={{ color: 'var(--p)' }}>{arc.earn}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>{/* end content area */}

          {/* Footer */}
          <div className="flex items-center justify-between px-5 pt-2 pb-3.5 relative z-[3]">
            <div className="flex gap-1 items-center">
              {[0,1,2,3].map(i => (
                <div
                  key={i}
                  className="dot-ind h-[5px] rounded-[3px] transition-all duration-[350ms]"
                  style={{ background: i === 0 ? 'var(--p)' : 'rgba(0,217,138,0.2)', width: i === 0 ? 18 : 5 }}
                />
              ))}
            </div>
            <span id="footer-label" className="text-[10px] font-bold tracking-[1px]" style={{ color: 'var(--p)' }}>Reel Studio</span>
            <span id="footer-hint" className="text-[9px]" style={{ color: 'var(--tm)' }}>Auto-cycling · 3.5s</span>
          </div>
        </div>
      </div>

      {/* ════════════════ PHASE 2 — Mobile Phone ════════════════ */}
      <div id="ph2" className="bs-root flex-col items-center justify-center w-full" style={{ display: 'none' }}>
        <div className="relative -mt-8">
          <div
            className="w-[320px] rounded-[38px] overflow-hidden relative z-[1] bg-[#0A1612]"
            style={{
              backgroundImage: 'linear-gradient(rgba(0,217,138,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,217,138,0.022) 1px,transparent 1px)',
              backgroundSize: '22px 22px',
              boxShadow: '0 0 0 10px #0b1a14, 0 0 0 11.5px rgba(0,217,138,0.25)',
            }}
          >
            {/* Reels overlay */}
            <div
              id="reels-overlay"
              className="absolute inset-0 z-50 flex-col rounded-[38px] overflow-hidden h-[580px] w-full opacity-0"
              style={{ display: 'none' }}
            >
              <div id="reels-slider" className="flex flex-col h-[1740px] will-change-transform">
                {[
                  { creator: '@stylemint.official', name: 'StyleMint', caption: 'Glow all season with our Serum Routine ✨ #skincare #stylemint',                    product: 'Bright Boost Gel Cream',  price: 'Rs 1,200', likes: '24.1k', comments: '891', shares: '2.3k', video: '/videos/reel1.mp4' },
                  { creator: '@aisha.creates',      name: 'Aisha K.',  caption: 'My complete skincare routine ft. @stylemint 🌿 Must-try for winter skin! #glowup', product: 'Brooklyn NYC Hoodie',     price: 'Rs 2,400', likes: '18.6k', comments: '642', shares: '1.8k', video: '/videos/reel2.mp4' },
                  { creator: '@priya.style',        name: 'Priya R.',  caption: 'Obsessed with these sneakers 🔥 Copped from @stylemint this season! #sneakerhead', product: 'Dunk Low Green Sneakers', price: 'Rs 4,500', likes: '15.2k', comments: '534', shares: '1.4k', video: '/videos/reel3.mp4' },
                ].map((reel, ri) => (
                  <div key={ri} className="flex-shrink-0 h-[580px] w-full relative bg-[#050e0b] overflow-hidden flex flex-col justify-end">
                    <video className="reel-video absolute inset-0 w-full h-full object-cover z-0" src={reel.video} muted loop playsInline preload="auto" />
                    <div className="absolute inset-0 z-[1]" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0.15) 0%,rgba(0,0,0,0.65) 100%)' }} />
                    {/* progress bar */}
                    <div className="absolute top-11 left-3 right-[52px] h-0.5 rounded-sm overflow-hidden z-10" style={{ background: 'rgba(255,255,255,0.2)' }}>
                      <div className="reel-pb-fill h-full w-0 bg-white rounded-sm" />
                    </div>
                    {/* right actions */}
                    <div className="absolute right-2.5 bottom-[120px] flex flex-col items-center gap-[18px] z-10">
                      {[
                        { icon: 'ti-heart',          count: reel.likes    },
                        { icon: 'ti-message-circle', count: reel.comments },
                        { icon: 'ti-share',          count: reel.shares   },
                        { icon: 'ti-shopping-bag',   count: ''            },
                      ].map((btn, bi) => (
                        <div key={bi} className="flex flex-col items-center gap-[3px]">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                            <i className={`ti ${btn.icon} text-base text-white`} />
                          </div>
                          {btn.count && <span className="text-[9px] text-white font-semibold">{btn.count}</span>}
                        </div>
                      ))}
                    </div>
                    {/* bottom content */}
                    <div className="relative z-10 px-3 pb-3.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-extrabold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg,#00D98A,#00B872)', color: '#0A1612' }}
                        >{reel.name[0]}</div>
                        <div className="flex-1">
                          <span className="text-[11px] font-bold text-white">{reel.creator}</span>
                        </div>
                        <div className="px-2.5 py-[3px] rounded-[6px] border border-white text-[9px] font-bold text-white">Following</div>
                      </div>
                      <div className="text-[10px] leading-[1.4] mb-2" style={{ color: 'rgba(255,255,255,0.85)' }}>{reel.caption}</div>
                      <div className="flex items-center gap-2 rounded-[10px] p-[7px_10px]" style={{ background: 'rgba(10,22,18,0.85)', border: '1px solid rgba(0,217,138,0.2)' }}>
                        <div className="w-8 h-8 rounded-[6px] flex items-center justify-center flex-shrink-0" style={{ background: '#1A332C', border: '1.5px dashed rgba(0,217,138,0.2)' }}>
                          <i className="ti ti-camera text-[12px]" style={{ color: 'rgba(0,217,138,0.3)' }} />
                        </div>
                        <div className="flex-1">
                          <div className="text-[9px] font-bold text-white leading-[1.2]">{reel.product}</div>
                          <div className="text-[10px] font-extrabold" style={{ color: 'var(--p)' }}>{reel.price}</div>
                        </div>
                        <div className="px-2 py-1 rounded-[6px] text-[8px] font-extrabold whitespace-nowrap" style={{ background: 'var(--p)', color: '#0A1612' }}>Add to Cart</div>
                      </div>
                    </div>
                    {/* bottom nav */}
                    <div className="flex justify-around items-center px-1.5 pt-[7px] pb-3 z-10 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.6)' }}>
                      {['ti-home','ti-compass','ti-player-play','ti-shopping-bag','ti-user'].map((icon, ii) => (
                        <div key={ii} className="flex flex-col items-center gap-0.5">
                          <i className={`ti ${icon} text-[17px]`} style={{ color: ii === 2 ? 'var(--p)' : 'rgba(255,255,255,0.6)' }} />
                          {ii === 2 && <div className="w-1 h-1 rounded-full" style={{ background: 'var(--p)' }} />}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* notch */}
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[58px] h-3.5 bg-black rounded-lg z-[30] flex items-center justify-center gap-1">
              <div className="w-[5px] h-[5px] rounded-full bg-[#222]" />
              <div className="w-[3px] h-[3px] rounded-full" style={{ background: '#00D98A', animation: 'pingDot 2s infinite' }} />
            </div>

            <div className="h-[580px] flex flex-col overflow-hidden">
              {/* status bar */}
              <div className="px-4 pt-[30px] pb-1.5 flex justify-between items-center flex-shrink-0">
                <span className="text-[11px] font-extrabold text-white">9:41</span>
                <div className="flex gap-1">
                  <i className="ti ti-wifi text-[11px] text-white" />
                  <i className="ti ti-battery-2 text-[11px] text-white" />
                </div>
              </div>
              {/* welcome */}
              <div className="px-4 pb-2.5 flex-shrink-0">
                <div className="text-[10px]" style={{ color: 'var(--tm)' }}>Welcome back,</div>
                <div
                  className="text-[17px] font-extrabold inline-block"
                  style={{ background: 'linear-gradient(135deg,#fff 0%,#00D98A 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
                >StyleMint</div>
              </div>

              {/* scroll area */}
              <div id="scroll-outer" className="flex-1 overflow-hidden relative">
                <div id="scroll-inner" className="relative bg-[#0A1612]">

                  {/* hero strip */}
                  <div className="overflow-hidden px-4 mb-2.5">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs font-bold text-white">Featured</span>
                      <span className="text-[10px]" style={{ color: 'var(--p)' }}>See all</span>
                    </div>
                    <div id="hero-rail" className="flex gap-2.5 w-max">
                      {[
                        { discount: '20% OFF', title: 'Bright Boost Gel Cream', img: '/images/beauty1.jpg'     },
                        { discount: 'NEW',     title: 'Crop Zip Hoodie',        img: '/images/girlytshirt1.jpg'},
                        { discount: '10% OFF', title: 'Brooklyn NYC Hoodie',    img: '/images/hoodie1.jpg'     },
                        { discount: '15% OFF', title: 'NY 90 Oversized Jersey', img: '/images/tshirt1.jpg'     },
                      ].map((card, i) => (
                        <div
                          key={i}
                          className="w-[218px] h-[128px] rounded-[14px] flex-shrink-0 relative overflow-hidden flex flex-col justify-end px-3 pb-2.5"
                          style={{ background: 'var(--bge)', border: '1px solid var(--bp)' }}
                        >
                          <img src={card.img} alt="" className="absolute inset-0 w-full h-full object-cover z-0" />
                          <div className="absolute inset-0 z-[1]" style={{ background: 'linear-gradient(180deg,transparent 25%,rgba(0,0,0,0.72) 100%)' }} />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[9px] text-black z-[2] pl-[1px]" style={{ background: 'rgba(255,255,255,0.9)' }}>▶</div>
                          <div className="absolute top-[9px] left-[9px] rounded-[5px] px-1.5 py-[3px] text-[7px] font-extrabold z-[3]" style={{ background: 'rgba(0,217,138,0.9)', color: 'var(--bg)' }}>{card.discount}</div>
                          <div className="relative z-[2]">
                            <div className="text-[8px] font-bold mb-0.5" style={{ color: 'var(--ts)' }}>StyleMint</div>
                            <div className="text-[11px] font-extrabold text-white leading-[1.25] mb-1.5">{card.title}</div>
                            <div className="inline-block rounded-[6px] px-2 py-1 text-[8px] font-extrabold" style={{ background: 'var(--p)', color: 'var(--bg)' }}>BUY NOW</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Creator Reels grid */}
                  <div className="px-4 pb-3">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs font-bold text-white">Creator Reels</span>
                      <span className="text-[10px]" style={{ color: 'var(--p)' }}>See all</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { grad: 'linear-gradient(135deg,#00D98A,#00B872)', init: 'AK', creator: '@aisha.creates', time: '2h ago',  title: 'Morning glow routine with StyleMint serum', product: '🌿 Glow Serum · Rs 1,200', views: '24.1k', likes: '3.2k', earn: '+Rs 4,200', img: '/images/beauty1.jpg'   },
                        { grad: 'linear-gradient(135deg,#60a5fa,#a78bfa)', init: 'PR', creator: '@priya.style',   time: '4h ago',  title: 'Styling the Brooklyn hoodie ✨',            product: '👗 Hoodie · Rs 2,400',      views: '18.6k', likes: '2.8k', earn: '+Rs 3,100', img: '/images/hoodie1.jpg'   },
                        { grad: 'linear-gradient(135deg,#fbbf24,#f87171)', init: 'MT', creator: '@mita.trends',   time: '6h ago',  title: 'Best denim for petite girls!',             product: '👖 Jeans · Rs 2,800',       views: '15.2k', likes: '2.1k', earn: '+Rs 2,600', img: '/images/pants1.jpg'    },
                        { grad: 'linear-gradient(135deg,#34d399,#059669)', init: 'RJ', creator: '@raju.vlogs',    time: '8h ago',  title: 'Nike Dunk Low unboxing 🔥',                product: '👟 Sneakers · Rs 4,500',    views: '12.4k', likes: '1.9k', earn: '+Rs 5,400', img: '/images/shoes1.jpg'    },
                        { grad: 'linear-gradient(135deg,#f472b6,#e879f9)', init: 'SN', creator: '@sana.fashion',  time: '10h ago', title: 'Platform clogs are trending this season',  product: '👡 Clogs · Rs 2,100',       views: '9.8k',  likes: '1.4k', earn: '+Rs 1,900', img: '/images/sandal1.jpg'   },
                        { grad: 'linear-gradient(135deg,#818cf8,#6366f1)', init: 'DK', creator: '@deep.style',    time: '12h ago', title: 'Fleece shorts casual day look 😎',         product: '🩳 Shorts · Rs 1,600',      views: '8.3k',  likes: '1.1k', earn: '+Rs 1,400', img: '/images/halfpant1.jpg' },
                      ].map((r, i) => (
                        <div key={i} className="rounded-xl overflow-hidden p-[9px_9px_8px]" style={{ background: 'var(--bgc)', border: '1px solid rgba(0,217,138,0.08)' }}>
                          <div className="flex items-center gap-[5px] mb-2">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-extrabold text-white flex-shrink-0" style={{ background: r.grad }}>{r.init}</div>
                            <span className="text-[8px] font-bold flex-1 overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: 'var(--ts)' }}>{r.creator}</span>
                            <span className="text-[7px] flex-shrink-0" style={{ color: 'var(--tm)' }}>{r.time}</span>
                          </div>
                          <div className="flex gap-[7px] mb-2">
                            <div className="w-[52px] h-[52px] rounded-lg overflow-hidden flex-shrink-0 relative">
                              <img src={r.img} alt="" className="w-full h-full object-cover block" />
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[6px] text-black pl-[1px]" style={{ background: 'rgba(255,255,255,0.9)' }}>▶</div>
                            </div>
                            <div className="flex-1 flex flex-col gap-1 min-w-0">
                              <div className="text-[8px] font-bold text-white leading-[1.3]">{r.title}</div>
                              <div className="inline-flex items-center gap-[3px] rounded-[5px] px-[5px] py-[2px]" style={{ background: 'rgba(0,217,138,0.1)', border: '1px solid rgba(0,217,138,0.2)' }}>
                                <span className="text-[7px] font-semibold" style={{ color: 'var(--p)' }}>{r.product}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex gap-[7px] items-center">
                              <span className="flex items-center gap-0.5 text-[7px]" style={{ color: 'var(--tm)' }}>
                                <i className="ti ti-eye text-[8px]" />{r.views}
                              </span>
                              <span className="flex items-center gap-0.5 text-[7px] text-[#f87171]">
                                <i className="ti ti-heart text-[8px]" />{r.likes}
                              </span>
                            </div>
                            <span className="text-[8px] font-bold" style={{ color: 'var(--p)' }}>{r.earn}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reels rail */}
                  <div className="px-4 pt-3 pb-[80px]">
                    <div className="flex justify-between items-center mb-2.5">
                      <span className="text-[13px] font-bold text-white">Reels</span>
                      <span className="text-[10px]" style={{ color: 'var(--p)' }}>See all</span>
                    </div>
                    <div className="overflow-hidden">
                      <div id="reels-rail" className="flex gap-2.5 w-max">
                        {[
                          { img: '/images/shoes1.jpg',  label: 'Trending', title: 'Sneaker Drop 2025',       featured: false },
                          { img: '/images/hoodie1.jpg', label: 'Trending', title: 'Brooklyn Style Edit',     featured: true  },
                          { img: '/images/pants1.jpg',  label: 'New',      title: 'Denim Season Must-Haves', featured: false },
                          { img: '/images/beauty1.jpg', label: 'Hot',      title: 'Skincare Glow Routine',   featured: false },
                        ].map((r, i) => (
                          <div
                            key={i}
                            className={cn('w-[148px] flex-shrink-0 rounded-xl overflow-hidden bg-[#0d1a17]', r.featured ? 'border-[1.5px] border-[rgba(0,217,138,0.4)]' : 'border border-[rgba(255,255,255,0.06)]')}
                          >
                            <div className="h-[100px] relative overflow-hidden">
                              <img src={r.img} alt="" className="w-full h-full object-cover block" />
                              <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,transparent 40%,rgba(0,0,0,0.55) 100%)' }} />
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-black pl-[1px]" style={{ background: 'rgba(255,255,255,0.9)' }}>▶</div>
                              <span
                                className={cn('absolute bottom-[7px] left-2 text-[7px] font-bold px-1.5 py-[2px] rounded', r.featured ? 'text-[#0A1612]' : 'text-white')}
                                style={{ background: r.featured ? 'var(--p)' : 'rgba(0,0,0,0.5)' }}
                              >{r.label}</span>
                            </div>
                            <div className="p-[7px_9px_9px]">
                              <div className="text-[9px] font-bold text-white leading-[1.35]">{r.title}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* bottom nav */}
              <div className="flex justify-around items-center px-1.5 pt-[7px] pb-3 flex-shrink-0 z-10" style={{ background: 'rgba(0,0,0,0.6)' }}>
                {['ti-home','ti-compass','ti-player-play','ti-shopping-bag','ti-user'].map((icon, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <i className={`ti ${icon} text-[17px]`} style={{ color: i === 0 ? 'var(--p)' : 'rgba(255,255,255,0.6)' }} />
                    {i === 0 && <div className="w-1 h-1 rounded-full" style={{ background: 'var(--p)' }} />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="text-center text-[9px] font-extrabold tracking-[3px] uppercase text-[var(--p)] pt-8 pb-1">
          Creator Studio · StyleMint
        </div>
      </div>

    </div>
  )
}
