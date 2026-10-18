import { Badge, Group, Popover, Stack, Table, Text, UnstyledButton } from '@mantine/core';
import { asFare, asFareLines, fareDistance, linesSummary, tierAdjustment, tierLabel, type FareLines, type RiderFareBreakdown } from '@/api/fare';
import { fmtMoney } from '@/lib/format';

function signed(amount: number, currency: string) {
  return `${amount < 0 ? '−' : '+'} ${fmtMoney(Math.abs(amount), currency)}`;
}

function multiplier(m: number) {
  return `×${Number(m.toFixed(2))}`;
}

/** How a rider fare is made up: base, distance (road or estimated), tier, each extra, rounding, total. */
export function FareBreakdownTable({ fare }: { fare: RiderFareBreakdown }) {
  const c = fare.currency;
  const rows: [string, string][] = [];
  if (fare.baseFare != null) rows.push(['Base fare', fmtMoney(fare.baseFare, c)]);
  if (fare.distanceAmount != null || fare.roadKm != null) {
    const rate = fare.perKm != null ? ` × ${fmtMoney(fare.perKm, c)}/km` : '';
    rows.push([`Distance · ${fareDistance(fare)}${rate}`, fare.distanceAmount != null ? fmtMoney(fare.distanceAmount, c) : '']);
  }
  if (fare.tier || fare.tierMultiplier != null) {
    const adj = tierAdjustment(fare);
    rows.push([`${tierLabel(fare.tier) ?? 'Tier'}${fare.tierMultiplier != null ? ` ${multiplier(fare.tierMultiplier)}` : ''}`, adj ? signed(adj, c) : '']);
  }
  if (fare.minimumApplied) rows.push(['Minimum fare applied', fare.minimumFare != null ? fmtMoney(fare.minimumFare, c) : '']);
  for (const e of fare.extras) rows.push([e.label || e.code, signed(e.amount, c)]);
  if (fare.rounding != null && Math.abs(fare.rounding) >= 0.005) rows.push([`Rounded${fare.roundTo ? ` to ${fmtMoney(fare.roundTo, c)}` : ''}`, signed(fare.rounding, c)]);

  return (
    <Stack gap={4} data-testid="fare-breakdown">
      <Table withRowBorders={false} verticalSpacing={2} horizontalSpacing={0} fz="sm">
        <Table.Tbody>
          {rows.map(([label, value]) => (
            <Table.Tr key={label}>
              <Table.Td c="dimmed" pr="md">
                {label}
              </Table.Td>
              <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                {value}
              </Table.Td>
            </Table.Tr>
          ))}
          <Table.Tr style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
            <Table.Td fw={600}>Total</Table.Td>
            <Table.Td ta="right" fw={600} style={{ whiteSpace: 'nowrap' }}>
              {fmtMoney(fare.total, c)}
            </Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
      {fare.method !== 'road' && (
        <Text size="xs" c="dimmed">
          Estimated: straight line {fare.straightLineKm != null ? `${fare.straightLineKm.toFixed(1)} km ` : ''}
          {fare.detourFactor != null ? `× ${fare.detourFactor} detour` : ''} - the road distance was not available.
        </Text>
      )}
    </Stack>
  );
}

/** The ledger's `{ lines }` form of a fare, with how the distance was priced when it says. */
export function FareLinesTable({ fare, currency }: { fare: FareLines; currency: string }) {
  const summary = linesSummary(fare);
  return (
    <Stack gap={4} data-testid="fare-lines">
      {summary && (
        <Text size="xs" c="dimmed">
          {summary}
        </Text>
      )}
      <Table withRowBorders={false} verticalSpacing={2} horizontalSpacing={0} fz="sm">
        <Table.Tbody>
          {fare.lines.map((l, i) => (
            <Table.Tr key={`${l.code}-${i}`}>
              <Table.Td c="dimmed" pr="md">
                {l.label || l.code}
              </Table.Td>
              <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                {fmtMoney(l.amount, currency)}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

/**
 * A fare amount for a table cell. With a breakdown it is a button that opens it, tagged "est." when the distance was
 * not road-priced; without one (priced before breakdowns shipped) it is just the amount.
 */
export function FareAmount({ amount, currency, breakdown }: { amount: number | null | undefined; currency: string; breakdown: unknown }) {
  const fare = asFare(breakdown);
  const lines = fare ? null : asFareLines(breakdown);
  const text = fmtMoney(amount ?? fare?.total, currency || fare?.currency);
  if (!fare && !(lines && (lines.lines.length > 1 || lines.method))) return <Text span size="sm">{text}</Text>;
  const estimated = fare ? fare.method !== 'road' : lines?.method === 'estimated';
  return (
    <Popover position="bottom-end" withArrow shadow="md" width={320}>
      <Popover.Target>
        <UnstyledButton
          onClick={(e) => e.stopPropagation()}
          aria-label={`Fare ${text}, show breakdown`}
          style={{ textDecoration: 'underline dotted', textUnderlineOffset: 3 }}
        >
          <Group gap={4} wrap="nowrap">
            <Text span size="sm">
              {text}
            </Text>
            {estimated && (
              <Badge size="xs" variant="light" color="amber">
                est.
              </Badge>
            )}
          </Group>
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown onClick={(e) => e.stopPropagation()}>
        {fare ? <FareBreakdownTable fare={fare} /> : <FareLinesTable fare={lines!} currency={currency} />}
      </Popover.Dropdown>
    </Popover>
  );
}
