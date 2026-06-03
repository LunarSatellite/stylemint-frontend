import { cn } from '@/lib/cn'
import { BrandShowcase } from '@/features/auth/BrandShowcase'
import { QRLoginPanel } from '@/features/auth/QRLoginPanel'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">

      {/* ── Left — Animated Showcase ── */}
      <div className="hidden lg:flex w-1/2 flex-col items-center justify-center p-10 overflow-hidden relative">
        <BrandShowcase />

        {/* Phase toggle */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex" style={{ background: '#0F1E1A', border: '1px solid rgba(0,217,138,0.15)', borderRadius: 999, padding: 4, gap: 4, alignItems: 'center' }}>
          <button id="toggle-studio" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: 'rgba(0,217,138,0.15)', color: '#00D98A', transition: 'all 0.3s ease', overflow: 'hidden' }}>
            <span id="toggle-studio-dot" style={{ width: 0, height: 8, borderRadius: '50%', background: '#00D98A', flexShrink: 0, opacity: 0, transition: 'all 0.3s ease' }} />
            <span id="toggle-studio-label" style={{ transition: 'all 0.3s ease', whiteSpace: 'nowrap', overflow: 'hidden' }}>Brand Studio</span>
          </button>
          <button id="toggle-mobile" style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '6px 6px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: 'transparent', color: '#7A9B8E', transition: 'all 0.3s ease', overflow: 'hidden' }}>
            <span id="toggle-mobile-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#7A9B8E', flexShrink: 0, transition: 'all 0.3s ease' }} />
            <span id="toggle-mobile-label" style={{ maxWidth: 0, opacity: 0, overflow: 'hidden', whiteSpace: 'nowrap', transition: 'all 0.3s ease' }}>Mobile App</span>
          </button>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="hidden lg:block w-px bg-[var(--border-subtle)] self-stretch" />

      {/* ── Right — QR Login Panel ── */}
      <div className="flex w-full lg:w-1/2 overflow-hidden">
        <QRLoginPanel />
      </div>
    </div>
  )
}
