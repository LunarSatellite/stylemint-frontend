import { formatInTimeZone } from 'date-fns-tz'

const TZ = 'Asia/Kathmandu'

export const formatDateTime = (iso: string) =>
  formatInTimeZone(new Date(iso), TZ, 'dd MMM yyyy, HH:mm')

export const formatDate = (iso: string) =>
  formatInTimeZone(new Date(iso), TZ, 'dd MMM yyyy')

export const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat('ne-NP', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)

export const formatPercent = (f: number | null) =>
  f == null ? '—' : `${(f * 100).toFixed(1)}%`

export const formatDelta = (d: number | null) =>
  d == null ? '—' : `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}%`

export const formatNumber = (n: number) =>
  new Intl.NumberFormat('en').format(n)

export const formatCompact = (n: number) =>
  new Intl.NumberFormat('en', { notation: 'compact' }).format(n)
