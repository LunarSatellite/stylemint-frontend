interface DataPoint {
  dateUtc: string
  revenueAmount: number
  currency: string
}

interface WorkerInput {
  points:     DataPoint[]
  windowDays: number
}

function aggregateToWeekly(points: DataPoint[]): DataPoint[] {
  const buckets = new Map<string, { total: number; currency: string; count: number }>()

  for (const p of points) {
    const date  = new Date(p.dateUtc)
    const monday = new Date(date)
    monday.setDate(date.getDate() - ((date.getDay() + 6) % 7))
    const key = monday.toISOString().split('T')[0] ?? p.dateUtc

    const existing = buckets.get(key)
    if (existing) {
      existing.total += p.revenueAmount
      existing.count++
    } else {
      buckets.set(key, { total: p.revenueAmount, currency: p.currency, count: 1 })
    }
  }

  return Array.from(buckets.entries()).map(([dateUtc, { total, currency }]) => ({
    dateUtc,
    revenueAmount: total,
    currency,
  }))
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { points, windowDays } = e.data
  const result = windowDays <= 90 ? points : aggregateToWeekly(points)
  self.postMessage(result)
}
