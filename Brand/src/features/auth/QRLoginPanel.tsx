import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useQrCreate } from '@/api/mutations/useQrCreate'
import { useQrExchange } from '@/api/mutations/useQrExchange'
import { useAuth } from '@/auth/store'
import { scheduleSilentRefresh } from '@/auth/silentRefresh'
import { parseClaims } from '@/auth/parseClaims'
import type { QrCreateResponse } from '@/api/schema'

const TARGET_APP   = 1 as const  // BrandStudio
const POLL_MS      = 2000
const TTL_SECONDS  = 120

function getDeviceFingerprint(): string {
  const KEY = 'sm_device_fp'
  let fp = localStorage.getItem(KEY)
  if (!fp) {
    fp = crypto.randomUUID()
    localStorage.setItem(KEY, fp)
  }
  return fp
}

type QrState = 'loading' | 'ready' | 'scanned' | 'approved' | 'rejected' | 'expired' | 'error'

export function QRLoginPanel() {
  const navigate   = useNavigate()
  const setToken   = useAuth((s) => s.setToken)
  const qrCreate   = useQrCreate()
  const qrExchange = useQrExchange()

  const [qrState,   setQrState]   = useState<QrState>('loading')
  const [session,   setSession]   = useState<QrCreateResponse | null>(null)
  const [countdown, setCountdown] = useState(TTL_SECONDS)

  const sessionRef    = useRef<QrCreateResponse | null>(null)
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const isPollingRef  = useRef(false)

  function stopAll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
  }

  function startCountdown() {
    setCountdown(TTL_SECONDS)
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(tickRef.current!); return 0 }
        return c - 1
      })
    }, 1000)
  }

  function startPolling(sess: QrCreateResponse) {
    if (pollRef.current) clearInterval(pollRef.current)
    isPollingRef.current = false

    pollRef.current = setInterval(async () => {
      if (isPollingRef.current) return
      const current = sessionRef.current
      if (!current) return

      isPollingRef.current = true
      try {
        const result = await qrExchange.mutateAsync({
          publicToken:  current.publicToken,
          clientSecret: current.clientSecret,
        })
        switch (result.status) {
          case 'Scanned':
            setQrState('scanned')
            break
          case 'Approved':
            setQrState('approved')
            break
          case 'Consumed':
            stopAll()
            if (result.auth?.accessToken) {
              setToken(result.auth.accessToken)
              const claims = parseClaims(result.auth.accessToken)
              scheduleSilentRefresh(claims.exp * 1000)
              navigate('/dashboard', { replace: true })
            }
            break
          case 'Rejected':
            stopAll()
            setQrState('rejected')
            break
          case 'Expired':
            stopAll()
            setQrState('expired')
            break
          default:
            break
        }
      } catch {
        stopAll()
        setQrState('expired')
      } finally {
        isPollingRef.current = false
      }
    }, POLL_MS)
  }

  async function createSession() {
    setQrState('loading')
    setCountdown(TTL_SECONDS)
    stopAll()
    sessionRef.current = null
    setSession(null)
    try {
      const data = await qrCreate.mutateAsync({
        targetApp:         TARGET_APP,
        deviceFingerprint: getDeviceFingerprint(),
        devicePlatform:    3,
        deviceModel:       navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Browser',
        deviceOsVersion:   navigator.platform,
      })
      sessionRef.current = data
      setSession(data)
      setQrState('ready')
      startPolling(data)
      startCountdown()
    } catch {
      setQrState('error')
    }
  }

  useEffect(() => {
    createSession()
    return () => stopAll()
  }, [])

  useEffect(() => { sessionRef.current = session }, [session])

  const canRetry = qrState === 'expired' || qrState === 'rejected' || qrState === 'error'

  return (
    <div
      className="min-h-[80vh] flex items-center justify-center px-5 pt-[60px] pb-10 relative overflow-hidden w-full"
      style={{
        background: `
          radial-gradient(ellipse 70% 50% at 50% 105%, rgba(0,217,138,0.22), transparent),
          radial-gradient(ellipse 40% 35% at 15% 95%,  rgba(0,255,163,0.14), transparent),
          radial-gradient(ellipse 40% 35% at 85% 95%,  rgba(0,184,114,0.13), transparent),
          radial-gradient(ellipse 60% 40% at 50% 0%,   rgba(0,217,138,0.06), transparent),
          #030d08
        `,
      }}
    >
      <style>{`
        @keyframes scanMove {
          0%   { top: 16px; opacity: 0 }
          8%   { opacity: 1 }
          92%  { opacity: 0.6 }
          100% { top: calc(100% - 16px); opacity: 0 }
        }
        @keyframes blink {
          0%,100% { opacity: 1 }
          50%     { opacity: 0.3 }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(30px) scale(0.96) }
          to   { opacity: 1; transform: none }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px) }
          to   { opacity: 1; transform: none }
        }
        @keyframes spin {
          to { transform: rotate(360deg) }
        }
        .qr-cta:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 12px 32px rgba(0,217,138,0.4), 0 4px 12px rgba(0,0,0,0.3) !important;
        }
      `}</style>

      {/* dot grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(0,217,138,0.08) 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      />
      {/* line mesh overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,217,138,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,217,138,0.025) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      {/* arc rings */}
      {[
        { w: 600,  h: 300, b: -150, op: 0.1  },
        { w: 800,  h: 400, b: -200, op: 0.06 },
        { w: 1000, h: 500, b: -250, op: 0.04 },
      ].map((r, i) => (
        <div
          key={i}
          className="absolute left-1/2 -translate-x-1/2 rounded-[50%] border pointer-events-none"
          style={{ width: r.w, height: r.h, bottom: r.b, borderColor: `rgba(0,217,138,${r.op})` }}
        />
      ))}

      {/* ambient orbs */}
      <div
        className="absolute w-[300px] h-[300px] -top-20 -right-20 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,217,138,0.18) 0%, transparent 70%)' }}
      />
      <div
        className="absolute w-[200px] h-[200px] bottom-[60px] -left-[60px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,217,138,0.18) 0%, transparent 70%)' }}
      />

      {/* top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-7 py-5">
        <div className="flex items-center gap-[7px] bg-[rgba(0,217,138,0.06)] border border-[rgba(0,217,138,0.15)] rounded-full px-3.5 py-1.5 pl-2.5">
          <i className="ti ti-sparkles text-sm text-[#00D98A]" />
          <span className="text-[10px] font-bold text-[#7A9B8E] tracking-[.5px] uppercase">StyleMint Platform</span>
        </div>
        <div className="bg-[rgba(0,217,138,0.06)] border border-[rgba(0,217,138,0.15)] rounded-full px-3.5 py-1.5 text-[10px] font-bold text-[#B8E6D5] tracking-[1px]">
          Brand Studio
        </div>
      </div>

      {/* main card */}
      <div className="w-[450px] relative z-[5]" style={{ animation: 'cardIn 0.7s cubic-bezier(0.34,1.1,0.64,1) both' }}>

        {/* card body */}
        <div
          className="rounded-[28px] border border-[rgba(0,217,138,0.2)] overflow-hidden relative"
          style={{
            background: 'linear-gradient(160deg, rgba(20,42,34,0.96) 0%, rgba(8,18,13,0.98) 100%)',
            boxShadow: '0 0 0 1px rgba(0,255,163,0.05) inset, 0 40px 80px rgba(0,0,0,0.7), 0 0 60px rgba(0,217,138,0.08)',
          }}
        >
          {/* shimmer line */}
          <div
            className="absolute top-0 left-0 right-0 h-px z-[2]"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(0,255,163,0.6), rgba(0,217,138,0.4), transparent)' }}
          />
          {/* top glow beam */}
          <div
            className="absolute -top-[60px] left-1/2 -translate-x-1/2 w-[260px] h-[160px] pointer-events-none z-0"
            style={{ background: 'radial-gradient(ellipse, rgba(0,217,138,0.28) 0%, transparent 70%)' }}
          />

          {/* card header */}
          <div className="flex items-center justify-between px-[22px] pt-[22px] pb-[18px] relative z-[1]">
            <div className="flex items-center gap-[9px]">
              <div
                className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center text-[13px] font-black text-[#030d08] flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg,#00D98A,#00B872)',
                  boxShadow: '0 0 16px rgba(0,217,138,0.55), 0 4px 8px rgba(0,0,0,0.3)',
                }}
              >S</div>
              <div>
                <div
                  className="text-[13px] font-extrabold tracking-[.3px] inline-block"
                  style={{
                    background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--primary) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >StyleMint</div>
                <div className="text-[9px] font-semibold text-[#7A9B8E] tracking-[.5px] uppercase mt-px">Brand Studio</div>
              </div>
            </div>
            <div className="flex items-center gap-[5px] bg-[rgba(0,217,138,0.08)] border border-[rgba(0,217,138,0.2)] rounded-full px-2.5 py-[5px]">
              <div className="w-[5px] h-[5px] rounded-full bg-[#00D98A]" style={{ animation: 'blink 1.5s ease-in-out infinite' }} />
              <span className="text-[9px] font-extrabold text-[#00D98A] tracking-[1px]">LIVE</span>
            </div>
          </div>

          {/* divider */}
          <div
            className="h-px mx-[22px]"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(0,217,138,0.15), rgba(0,217,138,0.08), transparent)' }}
          />

          {/* QR section */}
          <div className="px-[22px] pt-[22px] pb-[18px] relative z-[1]">
            {/* label row */}
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-[8px] font-bold text-[#7A9B8E] tracking-[2.5px] uppercase">Scan to Access</span>
              {qrState === 'ready' || qrState === 'scanned' || qrState === 'approved' ? (
                <span className="text-[8px] font-bold text-[rgba(0,217,138,0.5)] tracking-[1px]">
                  {countdown}s
                </span>
              ) : null}
            </div>

            {/* QR frame outer */}
            <div
              className="relative rounded-[20px] p-[3px] border border-[rgba(0,217,138,0.18)]"
              style={{ background: 'linear-gradient(145deg, rgba(0,217,138,0.08), rgba(0,184,114,0.04))' }}
            >
              {/* QR frame inner */}
              <div
                className="bg-[#070f0a] rounded-[18px] p-5 relative overflow-hidden"
                style={{
                  backgroundImage: 'radial-gradient(circle, rgba(0,217,138,0.1) 1px, transparent 1px)',
                  backgroundSize: '9px 9px',
                }}
              >
                {/* scan line — only when QR is ready */}
                {(qrState === 'ready' || qrState === 'scanned') && (
                  <div
                    className="absolute left-4 right-4 h-[1.5px] z-[3]"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(0,255,163,0.7), rgba(0,217,138,0.5), transparent)',
                      boxShadow: '0 0 8px rgba(0,217,138,0.5)',
                      animation: 'scanMove 2.2s ease-in-out infinite',
                    }}
                  />
                )}

                {/* corner brackets */}
                <div className="absolute inset-2 pointer-events-none z-[4]">
                  <div className="absolute top-0 left-0 w-[22px] h-[22px] border-t-2 border-l-2 border-[#00D98A] rounded-tl-[5px]" />
                  <div className="absolute top-0 right-0 w-[22px] h-[22px] border-t-2 border-r-2 border-[#00D98A] rounded-tr-[5px]" />
                  <div className="absolute bottom-0 left-0 w-[22px] h-[22px] border-b-2 border-l-2 border-[#00D98A] rounded-bl-[5px]" />
                  <div className="absolute bottom-0 right-0 w-[22px] h-[22px] border-b-2 border-r-2 border-[#00D98A] rounded-br-[5px]" />
                </div>

                {/* QR content area */}
                <div className="w-[310px] h-[260px] rounded-xl flex flex-col items-center justify-center gap-2.5 relative z-[2] mx-auto overflow-hidden">

                  {/* LOADING */}
                  {qrState === 'loading' && (
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full border-2 border-[rgba(0,217,138,0.2)] border-t-[#00D98A]"
                        style={{ animation: 'spin 0.8s linear infinite' }}
                      />
                      <span className="text-[9px] font-bold text-[rgba(0,217,138,0.4)] tracking-[2px] uppercase">Generating…</span>
                    </div>
                  )}

                  {/* READY / SCANNED — show actual QR */}
                  {(qrState === 'ready' || qrState === 'scanned') && session && (
                    <div className="relative flex flex-col items-center gap-2">
                      <div className="rounded-xl overflow-hidden p-2 bg-white">
                        <QRCodeSVG
                          value={session.qrPayload}
                          size={200}
                          bgColor="#ffffff"
                          fgColor="#030d08"
                          level="M"
                        />
                      </div>
                      {qrState === 'scanned' && (
                        <div className="flex items-center gap-1.5 bg-[rgba(0,217,138,0.12)] border border-[rgba(0,217,138,0.3)] rounded-full px-3 py-1">
                          <div className="w-[5px] h-[5px] rounded-full bg-[#00D98A]" style={{ animation: 'blink 1s ease-in-out infinite' }} />
                          <span className="text-[9px] font-extrabold text-[#00D98A] tracking-[1px] uppercase">Phone Detected</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* APPROVED */}
                  {qrState === 'approved' && (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,217,138,0.15)', border: '1px solid rgba(0,217,138,0.3)' }}>
                        <i className="ti ti-check text-[22px] text-[#00D98A]" />
                      </div>
                      <span className="text-[9px] font-bold text-[#00D98A] tracking-[2px] uppercase">Approved — Signing in…</span>
                    </div>
                  )}

                  {/* REJECTED */}
                  {qrState === 'rejected' && (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)' }}>
                        <i className="ti ti-x text-[22px] text-red-400" />
                      </div>
                      <span className="text-[9px] font-bold text-red-400 tracking-[2px] uppercase">Login Rejected</span>
                    </div>
                  )}

                  {/* EXPIRED / ERROR */}
                  {(qrState === 'expired' || qrState === 'error') && (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,217,138,0.06)', border: '1px solid rgba(0,217,138,0.15)' }}>
                        <i className="ti ti-refresh text-[22px] text-[rgba(0,217,138,0.5)]" />
                      </div>
                      <span className="text-[9px] font-bold text-[#7A9B8E] tracking-[2px] uppercase">
                        {qrState === 'expired' ? 'QR Expired' : 'Failed to Load'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* card bottom */}
          <div className="px-[22px] pb-[22px] mt-4 relative z-[1]">
            {/* scan hint */}
            <div className="flex items-center gap-2 mb-3.5 px-3.5 py-2.5 bg-[rgba(0,217,138,0.04)] border border-[rgba(0,217,138,0.1)] rounded-[10px]">
              <i className="ti ti-scan text-base text-[rgba(0,217,138,0.5)] flex-shrink-0" />
              <p className="text-[11px] text-[#7A9B8E] leading-[1.4] m-0">
                {qrState === 'scanned'
                  ? <>Phone detected. <span className="text-[#B8E6D5] font-semibold">Approve on your mobile app to continue.</span></>
                  : qrState === 'approved'
                  ? <span className="text-[#B8E6D5] font-semibold">Approved! Completing sign-in…</span>
                  : qrState === 'rejected'
                  ? <>Login was rejected. <span className="text-[#B8E6D5] font-semibold">Generate a new QR to try again.</span></>
                  : (qrState === 'expired' || qrState === 'error')
                  ? <>QR code expired. <span className="text-[#B8E6D5] font-semibold">Refresh to get a new one.</span></>
                  : <>Scan the QR Code to sign in.<br /><span className="text-[#B8E6D5] font-semibold">Access your Brand Studio dashboard.</span></>
                }
              </p>
            </div>

            {/* CTA button */}
            {canRetry ? (
              <button
                onClick={() => createSession()}
                className="qr-cta flex items-center justify-between w-full border-none cursor-pointer rounded-[14px] px-4 py-[14px] pl-5 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #00D98A 0%, #00C47E 50%, #00B872 100%)',
                  boxShadow: '0 8px 24px rgba(0,217,138,0.3), 0 2px 8px rgba(0,0,0,0.3)',
                  transition: 'transform .2s ease, box-shadow .2s ease',
                }}
              >
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />
                <span className="text-[18px] font-extrabold text-[#030d08] tracking-[.3px] relative z-[1]">Refresh QR Code</span>
                <div className="w-8 h-8 rounded-[9px] bg-[rgba(3,13,8,0.2)] flex items-center justify-center relative z-[1] flex-shrink-0">
                  <i className="ti ti-refresh text-[17px] text-[#030d08]" />
                </div>
              </button>
            ) : (
              <button
                className="qr-cta flex items-center justify-between w-full border-none rounded-[14px] px-4 py-[14px] pl-5 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #00D98A 0%, #00C47E 50%, #00B872 100%)',
                  boxShadow: '0 8px 24px rgba(0,217,138,0.3), 0 2px 8px rgba(0,0,0,0.3)',
                  opacity: 0.6,
                  cursor: 'default',
                }}
              >
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />
                <span className="text-[18px] font-extrabold text-[#030d08] tracking-[.3px] relative z-[1]">Go To Brand Studio</span>
                <div className="w-8 h-8 rounded-[9px] bg-[rgba(3,13,8,0.2)] flex items-center justify-center relative z-[1] flex-shrink-0">
                  <i className="ti ti-arrow-right text-[17px] text-[#030d08]" />
                </div>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
