import { AreaChart, BarChart, DonutChart } from '@mantine/charts';
import '@mantine/charts/styles.css';
import { Box, Group, Text } from '@mantine/core';
import { formatMoney, formatMoneyCompact, formatNumber } from '../../lib/format';
import type { ComparePoint } from './period';

/**
 * The chart library (@mantine/charts → recharts) lives only in this module, which the Insights
 * pages load lazily (`LazyTrendChart` etc. in components.tsx) — the main bundle and every other
 * page stay without it. Each chart also carries a text summary for screen readers.
 */

export type ValueKind = 'money' | 'count';

const fmt = (kind: ValueKind) => (v: number) => (kind === 'money' ? formatMoney(v) : formatNumber(Math.round(v * 100) / 100));
const fmtAxis = (kind: ValueKind) => (v: number) => (kind === 'money' ? formatMoneyCompact(v).replace('Rs ', '') : formatNumber(v));

export function TrendChart({
  points,
  kind,
  label,
  compare,
  height = 240,
}: {
  points: ComparePoint[];
  kind: ValueKind;
  label: string;
  compare: boolean;
  height?: number;
}) {
  const showPrev = compare && points.some((p) => p.previous !== null);
  const data = points.map((p) => ({ label: p.label, current: p.current, previous: p.previous ?? 0 }));
  const series = [{ name: 'current', label: 'This period', color: 'forest.6' }];
  if (showPrev) series.push({ name: 'previous', label: 'Previous period', color: 'slate.3' });
  return (
    <Box role="img" aria-label={`${label}: ${points.length} points`}>
      <AreaChart
        h={height}
        data={data}
        dataKey="label"
        series={series}
        curveType="monotone"
        withLegend={showPrev}
        legendProps={{ verticalAlign: 'bottom', height: 30 }}
        valueFormatter={fmt(kind)}
        yAxisProps={{ tickFormatter: fmtAxis(kind), width: 56 }}
        withGradient
        fillOpacity={0.25}
        strokeWidth={2}
        withDots={points.length <= 14}
        gridAxis="y"
        tickLine="none"
      />
    </Box>
  );
}

export function BarsChart({
  data,
  kind,
  label,
  height = 220,
  horizontal = false,
}: {
  data: { label: string; value: number }[];
  kind: ValueKind;
  label: string;
  height?: number;
  horizontal?: boolean;
}) {
  return (
    <Box role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${fmt(kind)(d.value)}`).join(', ')}`}>
      <BarChart
        h={height}
        data={data}
        dataKey="label"
        series={[{ name: 'value', label, color: 'forest.6' }]}
        orientation={horizontal ? 'vertical' : 'horizontal'}
        valueFormatter={fmt(kind)}
        yAxisProps={horizontal ? { width: 120 } : { tickFormatter: fmtAxis(kind), width: 56 }}
        xAxisProps={horizontal ? { tickFormatter: fmtAxis(kind) } : undefined}
        gridAxis={horizontal ? 'x' : 'y'}
        tickLine="none"
        barProps={{ radius: 4 }}
      />
    </Box>
  );
}

const DONUT_COLORS = ['forest.6', 'forest.3', 'slate.5', 'amber.5', 'cyan.6', 'slate.3', 'forest.8', 'amber.3'];

export function ShareDonut({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Group gap="lg" wrap="wrap" align="center" role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${Math.round(d.value)}%`).join(', ')}`}>
      <DonutChart
        size={150}
        thickness={22}
        data={data.map((d, i) => ({ name: d.label, value: Math.round(d.value * 10) / 10, color: DONUT_COLORS[i % DONUT_COLORS.length] }))}
        tooltipDataSource="segment"
        valueFormatter={(v) => `${v}%`}
      />
      <Box>
        {data.map((d, i) => (
          <Group key={d.label} gap={8} wrap="nowrap" mb={4}>
            <Box
              w={10}
              h={10}
              style={{ borderRadius: 3, background: `var(--mantine-color-${DONUT_COLORS[i % DONUT_COLORS.length].replace('.', '-')})` }}
            />
            <Text size="sm">{d.label}</Text>
            <Text size="sm" c="dimmed">
              {total > 0 ? `${Math.round((d.value / total) * 100)}%` : '—'}
            </Text>
          </Group>
        ))}
      </Box>
    </Group>
  );
}
