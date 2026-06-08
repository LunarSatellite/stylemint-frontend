import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useQRCreate } from '@/api/mutations/useQRCreate'
import { useQRExchange } from '@/api/queries/useQRExchange'
import { useAuth } from '@/auth/store'
import { safePath } from '@/auth/guards'
import { useServerAnchoredCountdown } from '@/hooks/useServerAnchoredCountdown'
import { showErrorToast } from '@/api/errors'
import { cn } from '@/lib/utils'

interface QRSession {
  publicToken: string
  clientSecret: string
  qrPayload: string
  expiresUtc: string
  serverNowUtc: string
}

export function QRLoginPanel() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [session, setSession] = useState<QRSession | null>(null)
  const consumedRef = useRef(false)

  const { mutate: createSession, isPending: isCreating } = useQRCreate()
  const exchange = useQRExchange(session?.publicToken ?? null, session?.clientSecret ?? null)
  const status = exchange.data?.status

  function startSession() {
    createSession(undefined, {
      onSuccess: (data) => {
        consumedRef.current = false
        setSession({
          publicToken: data.publicToken,
          clientSecret: data.clientSecret,
          qrPayload: data.qrPayload,
          expiresUtc: data.expiresUtc,
          serverNowUtc: new Date().toISOString(),
        })
      },
      onError: showErrorToast,
    })
  }

  // Create QR on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { startSession() }, [])

  // Navigate on Consumed
  useEffect(() => {
    if (status !== 'Consumed' || !exchange.data?.auth || consumedRef.current) return
    consumedRef.current = true
    useAuth.getState().setToken(exchange.data.auth.accessToken)
    navigate(safePath(searchParams.get('next')), { replace: true })
  }, [status, exchange.data, navigate, searchParams])

  const remaining = useServerAnchoredCountdown(
    session?.serverNowUtc ?? new Date().toISOString(),
    session?.expiresUtc ?? new Date().toISOString(),
  )

  // Auto-refresh when countdown reaches 0 or server reports Expired
  useEffect(() => {
    const shouldRefresh =
      (remaining === 0 && status !== 'Rejected' && status !== 'Consumed') ||
      status === 'Expired'
    if (!shouldRefresh || !session || isCreating) return
    setSession(null)
    startSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, status])

  const secs = Math.ceil(remaining / 1000)

  if (isCreating || !session) {
    return (
      <div
        className="w-[310px] h-[260px] rounded-xl border border-dashed border-[rgba(0,217,138,0.18)] flex items-center justify-center relative z-[2] mx-auto"
        style={{ background: 'linear-gradient(145deg, rgba(0,217,138,0.04), rgba(0,0,0,0.2))' }}
      >
        <div className="w-8 h-8 border-2 border-[#00D98A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (status === 'Rejected') {
    return (
      <div
        className="w-[310px] h-[260px] rounded-xl border border-dashed border-[rgba(239,68,68,0.3)] flex flex-col items-center justify-center gap-3 relative z-[2] mx-auto"
        style={{ background: 'rgba(239,68,68,0.04)' }}
      >
        <span className="text-[12px] font-semibold text-[rgba(239,100,100,0.9)]">Login rejected on your phone</span>
        <button
          onClick={startSession}
          className="text-[11px] font-bold text-[#00D98A] underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    )
  }

  const isScanned = status === 'Scanned' || status === 'Approved'

  return (
    <div className="relative w-[310px] h-[260px] mx-auto z-[2]">
      <div className={cn('w-full h-full rounded-xl flex items-center justify-center', isScanned && 'opacity-30')}>
        <QRCodeSVG
          value={session.qrPayload}
          size={220}
          bgColor="transparent"
          fgColor="#00D98A"
          level="M"
        />
      </div>

      {isScanned && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-[rgba(0,217,138,0.12)] border border-[rgba(0,217,138,0.35)] flex items-center justify-center">
            <svg
              width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="#00D98A" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span className="text-[12px] font-semibold text-[#00D98A]">Scanned — approve on your phone</span>
        </div>
      )}

      {!isScanned && secs > 0 && (
        <div className="absolute bottom-2 right-3 text-[9px] font-bold text-[rgba(0,217,138,0.4)] tabular-nums">
          {secs}s
        </div>
      )}
    </div>
  )
}
