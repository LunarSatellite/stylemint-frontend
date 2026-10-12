import { Box, Group, Text, Tooltip } from '@mantine/core';
import { formatDate, formatMoney, type Money } from '../lib/format';

/** A light bar chart for a revenue trend — plain elements, no chart library. */
export function TrendBars({ points, height = 120 }: { points: { date: string; amount: Money }[]; height?: number }) {
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => Number(p.amount.amount) || 0));
  const total = points.reduce((s, p) => s + (Number(p.amount.amount) || 0), 0);
  return (
    <figure style={{ margin: 0 }} aria-label={`Revenue per day, total ${formatMoney(total)}`}>
      <Group gap={3} align="flex-end" wrap="nowrap" h={height} role="img" aria-hidden>
        {points.map((p) => {
          const v = Number(p.amount.amount) || 0;
          return (
            <Tooltip key={p.date} label={`${formatDate(p.date)}: ${formatMoney(p.amount)}`}>
              <Box
                style={{
                  flex: 1,
                  minWidth: 3,
                  height: `${Math.max(2, (v / max) * 100)}%`,
                  borderRadius: '4px 4px 1px 1px',
                  background: v > 0 ? 'linear-gradient(180deg, #45ae86, #03875a)' : 'var(--sm-border)',
                }}
              />
            </Tooltip>
          );
        })}
      </Group>
      <Group justify="space-between" mt={6}>
        <Text size="xs" c="dimmed">
          {formatDate(points[0].date)}
        </Text>
        <Text size="xs" c="dimmed">
          {formatDate(points[points.length - 1].date)}
        </Text>
      </Group>
    </figure>
  );
}
