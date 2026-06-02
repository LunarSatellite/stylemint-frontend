import { formatInTimeZone } from 'date-fns-tz'

const TZ = 'Asia/Kathmandu'

export const formatDateTime = (iso: string) =>
  formatInTimeZone(new Date(iso), TZ, 'dd MMM yyyy, HH:mm')

export const formatInAudienceTz = (iso: string, tz: string) =>
  formatInTimeZone(new Date(iso), tz, 'EEE, dd MMM • HH:mm')

export const formatMs = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const formatPercent = (f: number) =>
  f == null ? '—' : `${(f * 100).toFixed(1)}%`

export const formatDelta = (d: number | null) =>
  d == null ? '—' : `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}%`
