import ReactECharts from 'echarts-for-react'
import type { TrafficSourceDto } from '@/api/schema'

interface TrafficSourceChartProps {
  sources: TrafficSourceDto[]
}

export function TrafficSourceChart({ sources }: TrafficSourceChartProps) {
  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
    legend: {
      bottom: 0,
      textStyle: { color: 'var(--text-muted)', fontSize: 10 },
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: sources.map((s) => ({
        name:  s.source,
        value: s.sessions,
      })),
      label: { show: false },
    }],
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Traffic Sources</p>
      <ReactECharts option={option} style={{ height: 220 }} />
      <table className="sr-only" aria-label="Traffic source data">
        <caption>Traffic sources breakdown</caption>
        <thead><tr><th>Source</th><th>Sessions</th><th>Share</th></tr></thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.source}>
              <td>{s.source}</td>
              <td>{s.sessions}</td>
              <td>{(s.sharePercent * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
