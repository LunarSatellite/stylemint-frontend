import { useEffect, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { RevenueTrendPointDto } from '@/api/schema'

interface RevenueTrendChartProps {
  points:     RevenueTrendPointDto[]
  windowDays: number
  currency:   string
}

export function RevenueTrendChart({ points, windowDays, currency }: RevenueTrendChartProps) {
  const [aggregated, setAggregated] = useState<RevenueTrendPointDto[]>(points)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../../workers/analyticsAggregator.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current.onmessage = (e: MessageEvent<RevenueTrendPointDto[]>) => {
      setAggregated(e.data)
    }
    workerRef.current.postMessage({ points, windowDays })
    return () => workerRef.current?.terminate()
  }, [points, windowDays])

  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: aggregated.map((p) => p.dateUtc.slice(0, 10)),
      axisLine:  { lineStyle: { color: 'var(--border-subtle)' } },
      axisLabel: { color: 'var(--text-muted)', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: 'var(--text-muted)', fontSize: 10, formatter: (v: number) => `${currency} ${v.toLocaleString()}` },
      splitLine: { lineStyle: { color: 'var(--surface-border)' } },
    },
    series: [{
      type: 'line',
      data: aggregated.map((p) => p.revenueAmount),
      smooth: true,
      lineStyle:   { color: 'var(--primary)', width: 2 },
      itemStyle:   { color: 'var(--primary)' },
      areaStyle:   { color: 'var(--glow-primary)' },
      symbol: 'none',
    }],
    grid: { top: 12, right: 12, bottom: 24, left: 60 },
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Revenue Trend</p>
      <ReactECharts option={option} style={{ height: 220 }} />
      <table className="sr-only" aria-label="Revenue trend data">
        <caption>Revenue trend — last {windowDays} days</caption>
        <thead><tr><th>Date</th><th>Revenue</th></tr></thead>
        <tbody>
          {aggregated.map((p) => (
            <tr key={p.dateUtc}>
              <td>{p.dateUtc}</td>
              <td>{p.revenueAmount} {p.currency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
