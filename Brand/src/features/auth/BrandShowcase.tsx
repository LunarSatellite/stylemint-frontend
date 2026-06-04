import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'

const INTERVAL = 3500

export function BrandShowcase() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const pendingTimers: ReturnType<typeof setTimeout>[] = []
    let cycleTimer: ReturnType<typeof setTimeout> | null = null
    let heroIdx = 0
    let currentPhase: 'studio' | 'mobile' = 'studio'
    let gen = 0 // incremented on cancelAll — kills any in-flight rAF callbacks

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
      gen++ // invalidates all stale rAF loops
      pendingTimers.forEach(clearTimeout)
      pendingTimers.length = 0
      if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null }
    }

    // ── fade helpers — gen-checked so stale loops self-terminate ─────────────
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

    // ── instant reset helpers ─────────────────────────────────────────────────
    function noTrans(el: HTMLElement) { el.style.transition = 'none' }

    function resetAllPanelElements() {
      $$('.brief-card').forEach(c => { noTrans(c); c.style.opacity = '0'; c.style.transform = 'translateY(14px)' })
      $$('.kpi-card').forEach(c => { noTrans(c); c.style.opacity = '0' })
      const cc = $('#chart-card'); if (cc) { noTrans(cc); cc.style.opacity = '0' }
      $$('.chart-bar').forEach(b => { noTrans(b); b.style.transform = 'scaleY(0)' })
      $$('.chart-bar-label').forEach(l => { noTrans(l); l.style.opacity = '0' })
      const crc = $('#creators-card'); if (crc) { noTrans(crc); crc.style.opacity = '0' }
      $$('.creator-row').forEach(r => { noTrans(r); r.style.opacity = '0'; r.style.transform = 'translateY(8px)' })
      $$('.creator-bar-fill').forEach(b => { noTrans(b); b.style.width = '0%' })
      $$('.act-row').forEach(r => { noTrans(r); r.style.opacity = '0'; r.style.transform = 'translateX(-14px)' })
      const ch = $('#collab-hero'); if (ch) { noTrans(ch); ch.style.opacity = '0' }
      $$('.collab-card').forEach(c => { noTrans(c); c.style.opacity = '0'; c.style.transform = 'translateY(14px)' })
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
      $$('.reel-pb-fill').forEach(b => { noTrans(b as HTMLElement); (b as HTMLElement).style.width = '0%' })
      $$('.reel-video').forEach(v => { const vid = v as HTMLVideoElement; vid.muted = true; vid.pause(); vid.currentTime = 0 })
    }

    // ── panel entrance animations ─────────────────────────────────────────────
    function animateBriefs() {
      $$('.brief-card').forEach((c, i) => {
        after(80 + i * 180, () => {
          c.style.transition = 'opacity 0.45s ease, transform 0.45s ease'
          c.style.opacity = '1'; c.style.transform = 'translateY(0)'
        })
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
          $$('.chart-bar-label').forEach(l => { l.style.opacity = '1' })
        })
      })
      after(1000, () => {
        const crc = $('#creators-card')
        if (crc) { crc.style.transition = 'opacity 0.4s ease'; crc.style.opacity = '1' }
        $$('.creator-row').forEach((r, i) => {
          after(i * 180, () => {
            r.style.transition = 'opacity 0.4s ease, transform 0.4s ease'
            r.style.opacity = '1'; r.style.transform = 'translateY(0)'
            after(200, () => {
              const fill = r.querySelector<HTMLElement>('.creator-bar-fill')
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

    function animateCollabs() {
      const ch = $('#collab-hero')
      after(80, () => { if (ch) { ch.style.transition = 'opacity 0.5s ease'; ch.style.opacity = '1' } })
      $$('.collab-card').forEach((c, i) => {
        after(280 + i * 200, () => {
          c.style.transition = 'opacity 0.45s ease, transform 0.45s ease'
          c.style.opacity = '1'; c.style.transform = 'translateY(0)'
        })
      })
    }

    const ANIMATE = [animateBriefs, animateAnalytics, animateActivity, animateCollabs]
    const LABELS  = ['Briefs', 'Analytics', 'Activity', 'Collabs']

    // ── go to panel n ─────────────────────────────────────────────────────────
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

      const lbl = $('#footer-label'); if (lbl) lbl.textContent = LABELS[n] ?? ''
      const hint = $('#footer-hint'); if (hint) hint.textContent = 'Auto-cycling · 3.5s'

      ANIMATE[n]?.()

      if (n === 3) {
        const hint2 = $('#footer-hint')
        after(INTERVAL - 400, () => { if (hint2) hint2.textContent = 'Launching mobile view…' })
        cycleTimer = setTimeout(() => transitionToPhase2(), INTERVAL)
      } else {
        cycleTimer = setTimeout(() => goTo(n + 1), INTERVAL)
      }
    }

    // ── Phase transitions ─────────────────────────────────────────────────────
    function transitionToPhase2() {
      cancelAll()
      const ph1 = $('#ph1')
      const ph2 = $('#ph2')
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
      const ph1 = $('#ph1')
      const ph2 = $('#ph2')
      if (!ph1 || !ph2) return

      fadeOut(ph2, 500, () => {
        ph2.style.display = 'none'
        ph1.style.display = 'block'
        currentPhase = 'studio'
        setToggleActive('studio')
        fadeIn(ph1, 600, -20, () => goTo(0))
      })
    }

    // ── Phase 2 animations ────────────────────────────────────────────────────
    function startHeroScroll() {
      after(600, scrollHero)
    }

    function scrollHero() {
      const rail = $('#hero-rail')
      if (!rail) return
      heroIdx++
      rail.style.transition = 'transform 0.85s cubic-bezier(0.4,0,0.2,1)'
      rail.style.transform = `translateX(-${heroIdx * 228}px)`
      if (heroIdx < 3) {
        after(2000, scrollHero)
      } else {
        after(900, startVerticalScroll)
      }
    }

    function startVerticalScroll() {
      const myGen = gen
      const outer = $('#scroll-outer')
      const inner = $('#scroll-inner')
      if (!outer || !inner) return
      const outerH = outer.offsetHeight
      const innerH = inner.scrollHeight
      const dist = innerH - outerH
      if (dist <= 0) { after(800, startReelsGrid); return }
      const duration = dist * 18
      let vsStart = 0

      function step(ts: number) {
        if (gen !== myGen) return
        if (!vsStart) vsStart = ts
        const raw = Math.min((ts - vsStart) / duration, 1)
        const ease = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2
        ;(inner as HTMLElement).style.transform = `translateY(-${Math.round(ease * dist)}px)`
        if (raw < 1) requestAnimationFrame(step)
        else after(800, startReelsGrid)
      }
      requestAnimationFrame(step)
    }

    // ── reels animations ──────────────────────────────────────────────────────
    function startReelsGrid() {
      const rail = $('#reels-rail')
      if (!rail) { after(200, openReelsView); return }
      // scroll to 2nd card
      rail.style.transition = 'transform 0.75s cubic-bezier(0.4,0,0.2,1)'
      rail.style.transform = 'translateX(-138px)'
      after(1000, openReelsView)
    }

    function openReelsView() {
      const myGen = gen
      const overlay = $('#reels-overlay')
      if (!overlay) { after(9000, transitionToPhase1); return }
      overlay.style.display = 'flex'
      overlay.style.opacity = '0'
      const start = performance.now()
      function rFadeIn(ts: number) {
        if (gen !== myGen) return
        const p = Math.min((ts - start) / 400, 1)
        ;(overlay as HTMLElement).style.opacity = String(p)
        if (p < 1) requestAnimationFrame(rFadeIn)
        else playReel(0)
      }
      requestAnimationFrame(rFadeIn)
    }

    function playReel(index: number) {
      const myGen = gen
      // control video playback — set muted imperatively (React JSX muted prop bug)
      $$('.reel-video').forEach((v, i) => {
        const vid = v as HTMLVideoElement
        vid.muted = true
        if (i === index) {
          vid.currentTime = 0
          const pr = vid.play()
          if (pr !== undefined) pr.catch(() => {})
        } else {
          vid.pause()
        }
      })
      // reset all progress bars, animate current
      $$('.reel-pb-fill').forEach(b => { noTrans(b as HTMLElement); (b as HTMLElement).style.width = '0%' })
      const fill = ($$('.reel-pb-fill')[index]) as HTMLElement | undefined
      if (fill) {
        requestAnimationFrame(() => {
          if (gen !== myGen) return
          fill.style.transition = 'width 5s linear'
          fill.style.width = '100%'
        })
      }

      after(5000, () => {
        if (index < 2) {
          const slider = $('#reels-slider')
          if (slider) {
            slider.style.transition = 'transform 0.65s cubic-bezier(0.4,0,0.2,1)'
            slider.style.transform = `translateY(-${(index + 1) * 580}px)`
          }
          after(350, () => playReel(index + 1))
        } else {
          const overlay2 = $('#reels-overlay')
          if (!overlay2) { transitionToPhase1(); return }
          const start2 = performance.now()
          function rFadeOut(ts: number) {
            if (gen !== myGen) return
            const p = Math.min((ts - start2) / 400, 1)
            ;(overlay2 as HTMLElement).style.opacity = String(1 - p)
            if (p < 1) requestAnimationFrame(rFadeOut)
            else transitionToPhase1()
          }
          requestAnimationFrame(rFadeOut)
        }
      })
    }

    // ── toggle active state ───────────────────────────────────────────────────
    function setToggleActive(phase: 'studio' | 'mobile') {
      const btnStudio  = document.getElementById('toggle-studio')
      const btnMobile  = document.getElementById('toggle-mobile')
      const lblStudio  = document.getElementById('toggle-studio-label')
      const lblMobile  = document.getElementById('toggle-mobile-label')
      const dotStudio  = document.getElementById('toggle-studio-dot')
      const dotMobile  = document.getElementById('toggle-mobile-dot')
      if (!btnStudio || !btnMobile || !lblStudio || !lblMobile) return

      if (phase === 'studio') {
        // studio → active: text only, no dot
        btnStudio.style.background = 'rgba(0,217,138,0.15)'
        btnStudio.style.color      = '#00D98A'
        btnStudio.style.padding    = '6px 16px'
        btnStudio.style.gap        = '0'
        if (dotStudio) { dotStudio.style.width = '0'; dotStudio.style.opacity = '0' }
        lblStudio.style.maxWidth   = '120px'
        lblStudio.style.opacity    = '1'
        // mobile → inactive: dot only, no text
        btnMobile.style.background = 'transparent'
        btnMobile.style.color      = '#7A9B8E'
        btnMobile.style.padding    = '6px 6px'
        btnMobile.style.gap        = '0'
        if (dotMobile) { dotMobile.style.width = '8px'; dotMobile.style.opacity = '1'; dotMobile.style.background = '#7A9B8E'; dotMobile.style.boxShadow = 'none' }
        lblMobile.style.maxWidth   = '0'
        lblMobile.style.opacity    = '0'
      } else {
        // mobile → active: text only, no dot
        btnMobile.style.background = 'rgba(0,217,138,0.15)'
        btnMobile.style.color      = '#00D98A'
        btnMobile.style.padding    = '6px 16px'
        btnMobile.style.gap        = '0'
        if (dotMobile) { dotMobile.style.width = '0'; dotMobile.style.opacity = '0' }
        lblMobile.style.maxWidth   = '120px'
        lblMobile.style.opacity    = '1'
        // studio → inactive: dot only, no text
        btnStudio.style.background = 'transparent'
        btnStudio.style.color      = '#7A9B8E'
        btnStudio.style.padding    = '6px 6px'
        btnStudio.style.gap        = '0'
        if (dotStudio) { dotStudio.style.width = '8px'; dotStudio.style.opacity = '1'; dotStudio.style.background = '#7A9B8E'; dotStudio.style.boxShadow = 'none' }
        lblStudio.style.maxWidth   = '0'
        lblStudio.style.opacity    = '0'
      }
    }

    // ── nav tab clicks ────────────────────────────────────────────────────────
    $$('.nav-tab').forEach((t, i) => {
      t.addEventListener('click', () => goTo(i))
    })

    // ── toggle clicks ─────────────────────────────────────────────────────────
    const btnStudio = document.getElementById('toggle-studio')
    const btnMobile = document.getElementById('toggle-mobile')

    function handleStudioClick() {
      if (currentPhase !== 'studio') transitionToPhase1()
    }
    function handleMobileClick() {
      if (currentPhase !== 'mobile') transitionToPhase2()
    }

    btnStudio?.addEventListener('click', handleStudioClick)
    btnMobile?.addEventListener('click', handleMobileClick)

    // kick off
    const ph2 = $('#ph2'); if (ph2) ph2.style.display = 'none'
    setToggleActive('studio')
    goTo(0)

    return () => {
      cancelAll()
      btnStudio?.removeEventListener('click', handleStudioClick)
      btnMobile?.removeEventListener('click', handleMobileClick)
    }
  }, [])

  const bars = [
    { h: 45,  day: 'M', val: 'Rs 1.2L' },
    { h: 62,  day: 'T', val: 'Rs 1.8L' },
    { h: 52,  day: 'W', val: 'Rs 1.5L' },
    { h: 78,  day: 'T', val: 'Rs 2.4L' },
    { h: 66,  day: 'F', val: 'Rs 2.0L' },
    { h: 90,  day: 'S', val: 'Rs 2.9L' },
    { h: 100, day: 'S', val: 'Rs 3.2L' },
  ]
  const barColors = [
    'rgba(0,217,138,0.28)', 'rgba(0,217,138,0.36)', 'rgba(0,217,138,0.42)',
    'rgba(0,217,138,0.50)', 'rgba(0,217,138,0.58)', 'rgba(0,217,138,0.68)',
    'linear-gradient(180deg,#00FFA3,#00D98A)',
  ]

  return (
    <div ref={rootRef} className="w-full flex flex-col items-center" style={{ fontFamily: 'inherit' }}>
      <style>{`
        .bs-root {
          --p:   #00D98A;
          --pd:  #00B872;
          --pl:  #00FFA3;
          --bg:  #0A1612;
          --bgc: #132420;
          --bge: #1A332C;
          --tp:  #ffffff;
          --ts:  #B8E6D5;
          --tm:  #7A9B8E;
          --bp:  rgba(0,217,138,0.2);
          --bs:  rgba(184,230,213,0.1);
          --am:  #fbbf24;
          --co:  #f87171;
          --bl:  #60a5fa;
          --pu:  #a78bfa;
        }
        @keyframes ping {
          0%   { transform: scale(1);   opacity: 1 }
          50%  { transform: scale(1.5); opacity: 0.4 }
          100% { transform: scale(1);   opacity: 1 }
        }
      `}</style>

      {/* ── PHASE 1 — Dashboard Panel ── */}
      <div id="ph1" className="bs-root block w-full">
        <div
          className="rounded-[20px] overflow-hidden relative border-[1.5px] border-[rgba(0,217,138,0.28)] bg-[#0A1612]"
          style={{
            backgroundImage: 'linear-gradient(rgba(0,217,138,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,217,138,0.022) 1px,transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        >
          {/* orbs */}
          <div className="absolute -top-10 -right-10 w-60 h-60 rounded-full pointer-events-none" style={{ background: 'rgba(0,217,138,0.05)' }} />
          <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full pointer-events-none" style={{ background: 'rgba(0,255,163,0.03)' }} />

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[rgba(0,217,138,0.08)] relative z-[3]">
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-[13px] text-[var(--bg)] flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#00D98A,#00B872)' }}
              >S</div>
              <div>
                <div
                  className="text-sm font-extrabold inline-block"
                  style={{
                    background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--primary) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >StyleMint</div>
                <div className="text-[9px] text-[var(--tm)]">Brand Studio Platform</div>
              </div>
            </div>
            <div className="bg-[rgba(0,217,138,0.1)] border border-[rgba(0,217,138,0.25)] rounded-[10px] px-2.5 py-1 flex items-center gap-1.5">
              <div className="w-[5px] h-[5px] rounded-full bg-[var(--p)]" style={{ animation: 'ping 1.4s infinite' }} />
              <span className="text-[9px] font-bold text-[var(--p)]">LIVE</span>
            </div>
          </div>

          {/* Nav Tabs */}
          <div className="flex gap-1.5 px-5 pt-2.5 relative z-[3]">
            {[
              { icon: 'ti-file-description', label: 'Briefs' },
              { icon: 'ti-chart-line',       label: 'Analytics' },
              { icon: 'ti-activity',         label: 'Activity' },
              { icon: 'ti-users',            label: 'Collabs' },
            ].map((t, i) => (
              <button
                key={i}
                className="nav-tab px-3.5 py-1.5 rounded-[10px] text-[10px] font-bold text-[var(--tm)] border border-transparent bg-transparent cursor-pointer flex items-center gap-[5px] transition-all duration-300"
              >
                <i className={`ti ${t.icon} text-[12px]`} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="relative min-h-[300px] px-5 pt-[14px] pb-[18px] z-[3]">

            {/* Panel 0 — Briefs */}
            <div className="panel absolute inset-x-5 top-[14px] bottom-[18px] opacity-0 pointer-events-none">
              <div className="flex justify-between mb-2.5">
                <span className="text-[9px] font-bold tracking-[2.5px] uppercase text-[var(--tm)]">Campaign Briefs</span>
                <span className="text-[9px] font-bold text-[var(--p)]">4 Active</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { emoji: '🌿', title: 'Winter Glow Campaign', state: 'Locked',  goal: 'Drive First Purchase', product: 'NaturalKit Serum', ver: 'v2', hooks: 3, creators: 12, roi: 'Rs 48k' },
                  { emoji: '✨', title: 'Spring Glow Drop',     state: 'Draft',   goal: 'Launch New Variant',   product: 'Lip Gloss Set',    ver: 'v1', hooks: 5, creators: 0,  roi: 'Rs 31k' },
                  { emoji: '💧', title: 'Hydration Series',     state: 'Locked',  goal: 'Educate on Use',       product: 'Hydrating Mist',   ver: 'v3', hooks: 4, creators: 8,  roi: 'Rs 22k' },
                  { emoji: '🌸', title: 'Festive Gifting',      state: 'Retired', goal: 'Seasonal Awareness',   product: 'Rose Toner',       ver: 'v1', hooks: 2, creators: 5,  roi: 'Rs 9k'  },
                ].map((b, i) => {
                  const isLocked = b.state === 'Locked', isDraft = b.state === 'Draft'
                  const accentBg    = isLocked ? 'linear-gradient(180deg,#00D98A,#00B872)' : isDraft ? 'linear-gradient(180deg,#fbbf24,rgba(251,191,36,0.3))' : 'rgba(255,255,255,0.1)'
                  const badgeBg     = isLocked ? 'rgba(0,217,138,0.12)' : isDraft ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.06)'
                  const badgeColor  = isLocked ? 'var(--p)' : isDraft ? '#fbbf24' : 'var(--tm)'
                  const badgeBorder = isLocked ? 'rgba(0,217,138,0.3)' : isDraft ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.1)'
                  return (
                    <div
                      key={i}
                      className="brief-card bg-[var(--bgc)] border border-[var(--bs)] rounded-[14px] p-3 relative overflow-hidden"
                      style={{ opacity: 0, transform: 'translateY(14px)' }}
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[3px]" style={{ background: accentBg }} />
                      <div className="flex justify-between items-center mb-[3px]">
                        <span className="text-[11px] font-extrabold text-[var(--tp)]">{b.emoji} {b.title}</span>
                        <span
                          className="text-[7px] font-bold px-[7px] py-[2px] rounded-[5px] ml-1 whitespace-nowrap"
                          style={{ background: badgeBg, color: badgeColor, border: `1px solid ${badgeBorder}` }}
                        >{b.state}</span>
                      </div>
                      <div className="text-[9px] text-[var(--tm)] mb-[5px]">{b.goal} · {b.product}</div>
                      <div className="flex justify-between items-center">
                        <div className="flex gap-1">
                          {[b.ver, `${b.hooks} hooks`, `${b.creators} creators`].map((tag, ti) => (
                            <span key={ti} className="text-[7px] px-1.5 py-[2px] bg-[var(--bs)] rounded text-[var(--ts)]">{tag}</span>
                          ))}
                        </div>
                        <span
                          className="text-[9px] font-bold"
                          style={{ background: 'linear-gradient(90deg,var(--p),var(--pl))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                        >{b.roi}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Panel 1 — Analytics */}
            <div className="panel absolute inset-x-5 top-[14px] bottom-[18px] opacity-0 pointer-events-none">
              <div className="flex justify-between mb-2.5">
                <span className="text-[9px] font-bold tracking-[2.5px] uppercase text-[var(--tm)]">Performance</span>
                <span className="text-[9px] font-bold text-[var(--p)]">Last 30 days</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { val: 'Rs 4.8L', label: 'Gross Sales', delta: '↑ +34%', pos: true  },
                      { val: '12,400',  label: 'Orders',       delta: '↑ +21%', pos: true  },
                      { val: '3.8%',    label: 'Conversion',   delta: '↓ -0.4%',pos: false },
                      { val: 'Rs 3.2L', label: 'Net Revenue',  delta: '↑ +28%', pos: true  },
                    ].map((k, i) => (
                      <div key={i} className="kpi-card bg-[var(--bgc)] border border-[var(--bs)] rounded-xl p-2.5 opacity-0 relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(0,217,138,0.5),transparent)' }} />
                        <div className="text-base font-extrabold text-[var(--tp)] leading-none">{k.val}</div>
                        <div className="text-[8px] text-[var(--tm)] my-0.5">{k.label}</div>
                        <div className={cn('text-[8px] font-bold', k.pos ? 'text-[#34d399]' : 'text-[var(--co)]')}>{k.delta}</div>
                      </div>
                    ))}
                  </div>
                  <div id="chart-card" className="bg-[var(--bgc)] border border-[var(--bs)] rounded-xl p-3 opacity-0">
                    <div className="flex justify-between mb-2">
                      <span className="text-[10px] font-bold text-[var(--ts)]">Revenue Trend</span>
                      <span className="text-[8px] text-[var(--tm)]">Last 7 days</span>
                    </div>
                    {/* bar chart — columns are relative so h-% on bars resolves against the 68px container */}
                    <div className="flex gap-[3px] h-[68px] items-end">
                      {bars.map((b, i) => (
                        <div key={i} className="flex-1 relative h-full flex flex-col justify-end">
                          {/* value label — fades in after bar via JS opacity trick */}
                          {b.h === 100 && (
                            <div className="chart-bar-label absolute -top-[14px] left-1/2 -translate-x-1/2 opacity-0 whitespace-nowrap" style={{ transition: 'opacity 0.3s ease 0.6s' }}>
                              <span className="text-[6px] font-bold text-[var(--p)]">Peak</span>
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
                            <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-[var(--p)] opacity-30" />
                            {b.h === 100 && (
                              <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(0,255,163,0.25),transparent)' }} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-[3px] mt-1">
                      {bars.map((b, i) => (
                        <div key={i} className={`flex-1 text-center text-[7px] ${b.h === 100 ? 'text-[var(--p)] font-bold' : 'text-[var(--tm)]'}`}>{b.day}</div>
                      ))}
                    </div>
                  </div>
                </div>
                <div id="creators-card" className="bg-[var(--bgc)] border border-[var(--bs)] rounded-xl p-3 opacity-0">
                  <div className="text-[10px] font-bold text-[var(--ts)] mb-2.5">Top Creators by Revenue</div>
                  {[
                    { rank: '#1', initials: 'AK', grad: 'linear-gradient(135deg,#00D98A,#00B872)', handle: '@aisha.creates', reach: '24.1k', match: '94%', rev: 'Rs 84.2k', tw: '95%' },
                    { rank: '#2', initials: 'PR', grad: 'linear-gradient(135deg,#60a5fa,#a78bfa)', handle: '@priya.style',   reach: '18.6k', match: '88%', rev: 'Rs 61.5k', tw: '70%' },
                    { rank: '#3', initials: 'RJ', grad: 'linear-gradient(135deg,#fbbf24,#f87171)', handle: '@raju.vlogs',    reach: '15.3k', match: '81%', rev: 'Rs 43.1k', tw: '50%' },
                  ].map((c, i) => (
                    <div key={i} className="creator-row mb-2.5 opacity-0" style={{ transform: 'translateY(8px)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[8px] font-extrabold text-[var(--tm)] w-3.5">{c.rank}</span>
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-extrabold text-white flex-shrink-0"
                          style={{ background: c.grad }}
                        >{c.initials}</div>
                        <div className="flex-1">
                          <div className="text-[9px] font-bold text-[var(--tp)]">{c.handle}</div>
                          <div className="text-[7px] text-[var(--tm)]">{c.reach} · {c.match} match</div>
                        </div>
                      </div>
                      <div className="ml-[22px]">
                        <div className="w-[50px] h-[5px] bg-[rgba(255,255,255,0.06)] rounded-[3px] overflow-hidden mb-0.5">
                          <div
                            className="creator-bar-fill h-full w-0 rounded-[3px]"
                            data-tw={c.tw}
                            style={{ background: 'linear-gradient(90deg,#00D98A,#00FFA3)' }}
                          />
                        </div>
                        <div className="text-[9px] font-extrabold text-[var(--p)]">{c.rev}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Panel 2 — Activity */}
            <div className="panel absolute inset-x-5 top-[14px] bottom-[18px] opacity-0 pointer-events-none">
              <div className="flex justify-between mb-2.5">
                <span className="text-[9px] font-bold tracking-[2.5px] uppercase text-[var(--tm)]">Recent Activity</span>
                <span className="text-[9px] font-bold text-[var(--p)]">Live Feed</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: 'ti-users',         iconBg: 'rgba(0,217,138,0.12)',    iconColor: 'var(--p)',   dot: '#00D98A', title: 'Partnership — @aisha.creates', sub: 'Winter Glow Campaign · 94% match',        badgeBg: 'rgba(0,217,138,0.1)',    badgeBd: 'rgba(0,217,138,0.3)',    badgeText: 'New',     badgeTc: 'var(--p)',   time: '2m ago'  },
                  { icon: 'ti-package',        iconBg: 'rgba(96,165,250,0.12)',  iconColor: '#60a5fa',   dot: '#60a5fa', title: 'Order #ORD-9821',              sub: 'Glow Serum × 2 · Rs 2,400',               badgeBg: 'rgba(96,165,250,0.1)',  badgeBd: 'rgba(96,165,250,0.3)',  badgeText: 'Order',   badgeTc: '#60a5fa',    time: '8m ago'  },
                  { icon: 'ti-truck',          iconBg: 'rgba(0,217,138,0.12)',    iconColor: 'var(--p)',   dot: '#00D98A', title: 'Shipped #ORD-9807',           sub: 'Night Cream · tracking active',            badgeBg: 'rgba(0,217,138,0.1)',    badgeBd: 'rgba(0,217,138,0.3)',    badgeText: 'Shipped', badgeTc: 'var(--p)',   time: '1h ago'  },
                  { icon: 'ti-currency-rupee', iconBg: 'rgba(251,191,36,0.12)',  iconColor: '#fbbf24',   dot: '#fbbf24', title: 'Payout Received',             sub: 'Rs 18,400 · Commission cycle',             badgeBg: 'rgba(251,191,36,0.1)',  badgeBd: 'rgba(251,191,36,0.3)',  badgeText: 'Paid',    badgeTc: '#fbbf24',    time: '2h ago'  },
                  { icon: 'ti-alert-triangle', iconBg: 'rgba(248,113,113,0.12)', iconColor: '#f87171',   dot: '#f87171', title: 'Low Inventory Alert',         sub: 'Hydrating Mist · Only 12 units',           badgeBg: 'rgba(248,113,113,0.1)', badgeBd: 'rgba(248,113,113,0.3)', badgeText: 'Alert',   badgeTc: '#f87171',    time: '3h ago'  },
                  { icon: 'ti-lock',           iconBg: 'rgba(167,139,250,0.12)', iconColor: '#a78bfa',   dot: '#a78bfa', title: 'Brief Locked',                sub: 'Spring Glow Drop · Ready for creators',    badgeBg: 'rgba(167,139,250,0.1)', badgeBd: 'rgba(167,139,250,0.3)', badgeText: 'Brief',   badgeTc: '#a78bfa',    time: '4h ago'  },
                ].map((a, i) => (
                  <div
                    key={i}
                    className="act-row flex items-start gap-2.5 bg-[var(--bgc)] border border-[var(--bs)] rounded-xl p-2.5"
                    style={{ opacity: 0, transform: 'translateX(-14px)' }}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-7 h-7 rounded-[9px] flex items-center justify-center" style={{ background: a.iconBg }}>
                        <i className={`ti ${a.icon} text-sm`} style={{ color: a.iconColor }} />
                      </div>
                      <div className="absolute -top-[3px] -right-[3px] w-2 h-2 rounded-full border-2 border-[var(--bg)]" style={{ background: a.dot }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-bold text-[var(--tp)] mb-[1px]">{a.title}</div>
                      <div className="text-[8px] text-[var(--tm)] mb-1">{a.sub}</div>
                      <div className="flex justify-between items-center">
                        <span
                          className="text-[7px] font-bold px-1.5 py-[2px] rounded"
                          style={{ background: a.badgeBg, border: `1px solid ${a.badgeBd}`, color: a.badgeTc }}
                        >{a.badgeText}</span>
                        <span className="text-[7px] text-[var(--tm)]">{a.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Panel 3 — Collabs */}
            <div className="panel absolute inset-x-5 top-[14px] bottom-[18px] opacity-0 pointer-events-none">
              <div className="flex justify-between mb-2.5">
                <span className="text-[9px] font-bold tracking-[2.5px] uppercase text-[var(--tm)]">Collaborations</span>
                <span className="text-[9px] font-bold text-[var(--p)]">AI Matched</span>
              </div>
              <div
                id="collab-hero"
                className="rounded-[14px] p-3.5 mb-2.5 flex items-center justify-between opacity-0 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg,rgba(0,217,138,0.1),rgba(0,184,114,0.04))', border: '1px solid rgba(0,217,138,0.18)' }}
              >
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(0,217,138,0.4),transparent)' }} />
                <div>
                  <div className="text-[8px] font-bold tracking-[2px] uppercase text-[var(--p)] mb-[3px]">AI MATCHING</div>
                  <div className="text-sm font-extrabold text-[var(--tp)] mb-0.5">Top Matched Creators</div>
                  <div className="text-[9px] text-[var(--tm)]">Based on your brief + audience data</div>
                </div>
                <div className="flex">
                  {[
                    { i: 'AK', g: 'linear-gradient(135deg,#00D98A,#00B872)' },
                    { i: 'PR', g: 'linear-gradient(135deg,#60a5fa,#a78bfa)' },
                    { i: 'MT', g: 'linear-gradient(135deg,#fbbf24,#f87171)' },
                    { i: '+4', g: 'rgba(255,255,255,0.1)' },
                  ].map((av, idx) => (
                    <div
                      key={idx}
                      className="w-7 h-7 rounded-full border-2 border-[var(--bg)] flex items-center justify-center text-[8px] font-extrabold text-white"
                      style={{ background: av.g, marginLeft: idx === 0 ? 0 : -7 }}
                    >{av.i}</div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { initials: 'AK', grad: 'linear-gradient(135deg,#00D98A,#00B872)', name: 'Aisha K.',  cat: 'Beauty',    score: '97%', tags: ['Skincare','Reels'], followers: '24.1k', eng: '8.4%', views: '180k' },
                  { initials: 'PR', grad: 'linear-gradient(135deg,#60a5fa,#a78bfa)', name: 'Priya R.',  cat: 'Lifestyle', score: '91%', tags: ['Makeup','Vlogs'],   followers: '18.6k', eng: '7.1%', views: '120k' },
                  { initials: 'MT', grad: 'linear-gradient(135deg,#fbbf24,#f87171)', name: 'Mita T.',   cat: 'Fashion',   score: '85%', tags: ['GRWM','Trends'],    followers: '15.3k', eng: '6.8%', views: '95k'  },
                ].map((c, i) => (
                  <div
                    key={i}
                    className="collab-card bg-[var(--bgc)] border border-[var(--bs)] rounded-[13px] p-3 relative overflow-hidden"
                    style={{ opacity: 0, transform: 'translateY(14px)' }}
                  >
                    <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(0,217,138,0.25),transparent)' }} />
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="flex items-center gap-[7px]">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white flex-shrink-0"
                          style={{ background: c.grad }}
                        >{c.initials}</div>
                        <div>
                          <div className="text-[10px] font-bold text-[var(--tp)]">{c.name}</div>
                          <div className="text-[8px] text-[var(--tm)]">{c.cat}</div>
                        </div>
                      </div>
                      <span className="text-[8px] font-bold px-1.5 py-[2px] rounded-[6px] bg-[rgba(0,217,138,0.1)] border border-[rgba(0,217,138,0.2)] text-[var(--p)]">{c.score}</span>
                    </div>
                    <div className="flex gap-1 mb-2 flex-wrap">
                      {c.tags.map((tag, ti) => (
                        <span key={ti} className="text-[7px] px-1.5 py-[2px] rounded bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[var(--tm)]">{tag}</span>
                      ))}
                    </div>
                    {[{ label: 'Followers', val: c.followers }, { label: 'Eng. Rate', val: c.eng }, { label: 'Avg Views', val: c.views }].map((m, mi) => (
                      <div key={mi} className="flex justify-between">
                        <span className="text-[8px] text-[var(--tm)]">{m.label}</span>
                        <span className="text-[8px] font-bold text-[var(--ts)]">{m.val}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 pt-2 pb-3.5 relative z-[3]">
            <div className="flex gap-1 items-center">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className="dot-ind h-[5px] rounded-[3px] transition-all duration-[350ms]"
                  style={{ background: i === 0 ? 'var(--p)' : 'rgba(0,217,138,0.2)', width: i === 0 ? 18 : 5 }}
                />
              ))}
            </div>
            <span id="footer-label" className="text-[10px] font-bold tracking-[1px] text-[var(--p)]">Briefs</span>
            <span id="footer-hint" className="text-[9px] text-[var(--tm)]">Auto-cycling · 3.5s</span>
          </div>
        </div>
      </div>

      {/* ── PHASE 2 — Mobile Phone ── */}
      <div id="ph2" className="bs-root flex-col items-center justify-center w-full" style={{ display: 'none' }}>
        <div className="relative -mt-8">
          {/* phone frame */}
          <div
            className="w-[320px] rounded-[38px] overflow-hidden relative z-[1] bg-[#0A1612]"
            style={{
              backgroundImage: 'linear-gradient(rgba(0,217,138,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,217,138,0.022) 1px,transparent 1px)',
              backgroundSize: '22px 22px',
              boxShadow: '0 0 0 10px #0b1a14, 0 0 0 11.5px rgba(0,217,138,0.25)',
            }}
          >
            {/* ── Reels overlay ── */}
            <div
              id="reels-overlay"
              className="absolute inset-0 z-50 flex-col rounded-[38px] overflow-hidden h-[580px] w-full opacity-0"
              style={{ display: 'none' }}
            >
              <div id="reels-slider" className="flex flex-col h-[1740px] will-change-transform">
                {[
                  { creator: '@stylemint.official', name: 'StyleMint', caption: 'Glow all season with our Serum Routine ✨ #skincare #stylemint',                    product: 'Bright Boost Gel Cream',   price: 'Rs 1,200', likes: '24.1k', comments: '891', shares: '2.3k', video: '/videos/reel1.mp4' },
                  { creator: '@aisha.creates',      name: 'Aisha K.',  caption: 'My complete skincare routine ft. @stylemint 🌿 Must-try for winter skin! #glowup', product: 'Brooklyn NYC Hoodie',      price: 'Rs 2,400', likes: '18.6k', comments: '642', shares: '1.8k', video: '/videos/reel2.mp4' },
                  { creator: '@priya.style',        name: 'Priya R.',  caption: 'Obsessed with these sneakers 🔥 Copped from @stylemint this season! #sneakerhead', product: 'Dunk Low Green Sneakers',  price: 'Rs 4,500', likes: '15.2k', comments: '534', shares: '1.4k', video: '/videos/reel3.mp4' },
                ].map((reel, ri) => (
                  <div key={ri} className="flex-shrink-0 h-[580px] w-full relative bg-[#050e0b] overflow-hidden flex flex-col justify-end">
                    <video className="reel-video absolute inset-0 w-full h-full object-cover z-0" src={reel.video} muted loop playsInline preload="auto" />
                    <div className="absolute inset-0 z-[1]" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0.15) 0%,rgba(0,0,0,0.65) 100%)' }} />
                    {/* progress bar */}
                    <div className="absolute top-11 left-3 right-[52px] h-0.5 bg-[rgba(255,255,255,0.2)] rounded-sm overflow-hidden z-10">
                      <div className="reel-pb-fill h-full w-0 bg-white rounded-sm" />
                    </div>
                    {/* right actions */}
                    <div className="absolute right-2.5 bottom-[120px] flex flex-col items-center gap-[18px] z-10">
                      {[
                        { icon: 'ti-heart',         count: reel.likes    },
                        { icon: 'ti-message-circle', count: reel.comments },
                        { icon: 'ti-share',          count: reel.shares   },
                        { icon: 'ti-shopping-bag',   count: ''            },
                      ].map((btn, bi) => (
                        <div key={bi} className="flex flex-col items-center gap-[3px]">
                          <div className="w-9 h-9 rounded-full bg-[rgba(255,255,255,0.15)] flex items-center justify-center">
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
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-extrabold text-[#0A1612] flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg,#00D98A,#00B872)' }}
                        >{reel.name[0]}</div>
                        <div className="flex-1">
                          <span className="text-[11px] font-bold text-white">{reel.creator}</span>
                        </div>
                        <div className="px-2.5 py-[3px] rounded-[6px] border border-white text-[9px] font-bold text-white">Following</div>
                      </div>
                      <div className="text-[10px] text-[rgba(255,255,255,0.85)] leading-[1.4] mb-2">{reel.caption}</div>
                      <div className="flex items-center gap-2 bg-[rgba(10,22,18,0.85)] rounded-[10px] p-[7px_10px] border border-[rgba(0,217,138,0.2)]">
                        <div className="w-8 h-8 rounded-[6px] bg-[#1A332C] border border-dashed border-[rgba(0,217,138,0.2)] flex items-center justify-center flex-shrink-0">
                          <i className="ti ti-camera text-[12px] text-[rgba(0,217,138,0.3)]" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[9px] font-bold text-white leading-[1.2]">{reel.product}</div>
                          <div className="text-[10px] font-extrabold text-[var(--p)]">{reel.price}</div>
                        </div>
                        <div className="px-2 py-1 rounded-[6px] bg-[var(--p)] text-[8px] font-extrabold text-[#0A1612] whitespace-nowrap">Add to Cart</div>
                      </div>
                    </div>
                    {/* bottom nav inside reel */}
                    <div className="flex justify-around items-center px-1.5 pt-[7px] pb-3 bg-[rgba(0,0,0,0.6)] z-10 flex-shrink-0">
                      {['ti-home','ti-compass','ti-player-play','ti-shopping-bag','ti-user'].map((icon, ii) => (
                        <div key={ii} className="flex flex-col items-center gap-0.5">
                          <i className={`ti ${icon} text-[17px]`} style={{ color: ii === 2 ? 'var(--p)' : 'rgba(255,255,255,0.6)' }} />
                          {ii === 2 && <div className="w-1 h-1 rounded-full bg-[var(--p)]" />}
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
              <div className="w-[3px] h-[3px] rounded-full bg-[#00D98A]" style={{ animation: 'ping 2s infinite' }} />
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
                <div className="text-[10px] text-[var(--tm)]">Welcome back,</div>
                <div
                  className="text-[17px] font-extrabold inline-block"
                  style={{
                    background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--primary) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >StyleMint</div>
              </div>

              {/* scroll area */}
              <div id="scroll-outer" className="flex-1 overflow-hidden relative">
                <div id="scroll-inner" className="relative bg-[#0A1612]">

                  {/* hero strip */}
                  <div className="overflow-hidden px-4 mb-2.5">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs font-bold text-white">Featured</span>
                      <span className="text-[10px] text-[var(--p)]">See all</span>
                    </div>
                    <div id="hero-rail" className="flex gap-2.5 w-max">
                      {[
                        { discount: '20% OFF', title: 'Bright Boost Gel Cream',  img: '/images/beauty1.jpg'      },
                        { discount: 'NEW',     title: 'Crop Zip Hoodie',         img: '/images/girlytshirt1.jpg' },
                        { discount: '10% OFF', title: 'Brooklyn NYC Hoodie',     img: '/images/hoodie1.jpg'      },
                        { discount: '15% OFF', title: 'NY 90 Oversized Jersey',  img: '/images/tshirt1.jpg'      },
                      ].map((card, i) => (
                        <div
                          key={i}
                          className="w-[218px] h-[128px] rounded-[14px] flex-shrink-0 bg-[var(--bge)] border border-[var(--bp)] relative overflow-hidden flex flex-col justify-end px-3 pb-2.5"
                        >
                          <img src={card.img} alt="" className="absolute inset-0 w-full h-full object-cover z-0" />
                          <div className="absolute inset-0 z-[1]" style={{ background: 'linear-gradient(180deg,transparent 25%,rgba(0,0,0,0.72) 100%)' }} />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[22px] h-[22px] rounded-full bg-[rgba(255,255,255,0.9)] flex items-center justify-center text-[9px] text-black z-[2] pl-[1px]">▶</div>
                          <div className="absolute top-[9px] left-[9px] bg-[rgba(0,217,138,0.9)] rounded-[5px] px-1.5 py-[3px] text-[7px] font-extrabold text-[var(--bg)] z-[3]">{card.discount}</div>
                          <div className="relative z-[2]">
                            <div className="text-[8px] font-bold text-[var(--ts)] mb-0.5">StyleMint</div>
                            <div className="text-[11px] font-extrabold text-white leading-[1.25] mb-1.5">{card.title}</div>
                            <div className="inline-block bg-[var(--p)] rounded-[6px] px-2 py-1 text-[8px] font-extrabold text-[var(--bg)]">BUY NOW</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Creator Reels */}
                  <div className="px-4 pb-3">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs font-bold text-white">Creator Reels</span>
                      <span className="text-[10px] text-[var(--p)]">See all</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { grad: 'linear-gradient(135deg,#00D98A,#00B872)', init: 'AK', creator: '@aisha.creates', time: '2h ago',  title: 'Morning glow routine with StyleMint serum', product: '🌿 Glow Serum · Rs 1,200', views: '24.1k', likes: '3.2k', earn: '+Rs 4,200', img: '/images/beauty1.jpg'    },
                        { grad: 'linear-gradient(135deg,#60a5fa,#a78bfa)', init: 'PR', creator: '@priya.style',   time: '4h ago',  title: 'Styling the Brooklyn hoodie ✨',            product: '👗 Hoodie · Rs 2,400',      views: '18.6k', likes: '2.8k', earn: '+Rs 3,100', img: '/images/hoodie1.jpg'    },
                        { grad: 'linear-gradient(135deg,#fbbf24,#f87171)', init: 'MT', creator: '@mita.trends',   time: '6h ago',  title: 'Best denim for petite girls!',             product: '👖 Jeans · Rs 2,800',       views: '15.2k', likes: '2.1k', earn: '+Rs 2,600', img: '/images/pants1.jpg'     },
                        { grad: 'linear-gradient(135deg,#34d399,#059669)', init: 'RJ', creator: '@raju.vlogs',    time: '8h ago',  title: 'Nike Dunk Low unboxing 🔥',                product: '👟 Sneakers · Rs 4,500',    views: '12.4k', likes: '1.9k', earn: '+Rs 5,400', img: '/images/shoes1.jpg'     },
                        { grad: 'linear-gradient(135deg,#f472b6,#e879f9)', init: 'SN', creator: '@sana.fashion',  time: '10h ago', title: 'Platform clogs are trending this season',  product: '👡 Clogs · Rs 2,100',       views: '9.8k',  likes: '1.4k', earn: '+Rs 1,900', img: '/images/sandal1.jpg'    },
                        { grad: 'linear-gradient(135deg,#818cf8,#6366f1)', init: 'DK', creator: '@deep.style',    time: '12h ago', title: 'Fleece shorts casual day look 😎',         product: '🩳 Shorts · Rs 1,600',      views: '8.3k',  likes: '1.1k', earn: '+Rs 1,400', img: '/images/halfpant1.jpg'  },
                      ].map((r, i) => (
                        <div key={i} className="bg-[var(--bgc)] border border-[rgba(0,217,138,0.08)] rounded-xl overflow-hidden p-[9px_9px_8px]">
                          <div className="flex items-center gap-[5px] mb-2">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-extrabold text-white flex-shrink-0" style={{ background: r.grad }}>{r.init}</div>
                            <span className="text-[8px] font-bold text-[var(--ts)] flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{r.creator}</span>
                            <span className="text-[7px] text-[var(--tm)] flex-shrink-0">{r.time}</span>
                          </div>
                          <div className="flex gap-[7px] mb-2">
                            <div className="w-[52px] h-[52px] rounded-lg overflow-hidden flex-shrink-0 relative">
                              <img src={r.img} alt="" className="w-full h-full object-cover block" />
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[rgba(255,255,255,0.9)] flex items-center justify-center text-[6px] text-black pl-[1px]">▶</div>
                            </div>
                            <div className="flex-1 flex flex-col gap-1 min-w-0">
                              <div className="text-[8px] font-bold text-white leading-[1.3]">{r.title}</div>
                              <div className="inline-flex items-center gap-[3px] bg-[rgba(0,217,138,0.1)] border border-[rgba(0,217,138,0.2)] rounded-[5px] px-[5px] py-[2px]">
                                <span className="text-[7px] text-[var(--p)] font-semibold">{r.product}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex gap-[7px] items-center">
                              <span className="flex items-center gap-0.5 text-[7px] text-[var(--tm)]">
                                <i className="ti ti-eye text-[8px]" />{r.views}
                              </span>
                              <span className="flex items-center gap-0.5 text-[7px] text-[#f87171]">
                                <i className="ti ti-heart-filled text-[8px]" />{r.likes}
                              </span>
                            </div>
                            <span className="text-[8px] font-bold text-[var(--p)]">{r.earn}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reels section */}
                  <div className="px-4 pt-3 pb-[80px]">
                    <div className="flex justify-between items-center mb-2.5">
                      <span className="text-[13px] font-bold text-white">Reels</span>
                      <span className="text-[10px] text-[var(--p)]">See all</span>
                    </div>
                    <div className="overflow-hidden">
                      <div id="reels-rail" className="flex gap-2.5 w-max">
                        {[
                          { img: '/images/shoes1.jpg',  label: 'Trending', title: 'Sneaker Drop 2025'       },
                          { img: '/images/hoodie1.jpg', label: 'Trending', title: 'Brooklyn Style Edit'     },
                          { img: '/images/pants1.jpg',  label: 'New',      title: 'Denim Season Must-Haves' },
                          { img: '/images/beauty1.jpg', label: 'Hot',      title: 'Skincare Glow Routine'   },
                        ].map((r, i) => (
                          <div
                            key={i}
                            className={cn(
                              'w-[148px] flex-shrink-0 rounded-xl overflow-hidden bg-[#0d1a17]',
                              i === 1 ? 'border-[1.5px] border-[rgba(0,217,138,0.4)]' : 'border border-[rgba(255,255,255,0.06)]',
                            )}
                          >
                            <div className="h-[100px] relative overflow-hidden">
                              <img src={r.img} alt="" className="w-full h-full object-cover block" />
                              <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,transparent 40%,rgba(0,0,0,0.55) 100%)' }} />
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[rgba(255,255,255,0.9)] flex items-center justify-center text-[8px] text-black pl-[1px]">▶</div>
                              <span
                                className={cn(
                                  'absolute bottom-[7px] left-2 text-[7px] font-bold px-1.5 py-[2px] rounded',
                                  i === 1 ? 'text-[#0A1612] bg-[var(--p)]' : 'text-white bg-[rgba(0,0,0,0.5)]',
                                )}
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
              <div className="flex justify-around items-center px-1.5 pt-[7px] pb-3 bg-[rgba(0,0,0,0.6)] flex-shrink-0 z-10">
                {['ti-home','ti-compass','ti-player-play','ti-shopping-bag','ti-user'].map((icon, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <i className={`ti ${icon} text-[17px]`} style={{ color: i === 0 ? 'var(--p)' : 'rgba(255,255,255,0.6)' }} />
                    {i === 0 && <div className="w-1 h-1 rounded-full bg-[var(--p)]" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* bottom label */}
        <div className="text-center text-[9px] font-extrabold tracking-[3px] uppercase text-[var(--p)] pt-8 pb-1">
          Brand Studio · StyleMint
        </div>
      </div>

    </div>
  )
}
