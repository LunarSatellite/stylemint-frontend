import { Alert, Box, Button, Divider, Group, Stack, Table, Text, Title } from '@mantine/core';
import { IconAlertTriangle, IconPrinter } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBlock, LoadingBlock } from '../../components/StateBlocks';
import { formatDate, formatDateTime } from '../../lib/format';
import { ordersApi, type PackingSlip } from './api';

function Slip({ slip }: { slip: PackingSlip }) {
  const a = slip.shipTo;
  return (
    <Box
      className="print-page"
      p="lg"
      mb="lg"
      style={{ background: '#fff', color: '#000', border: '1px solid var(--sm-border)', borderRadius: 12 }}
    >
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Title order={2} c="#000">
            Packing slip
          </Title>
          <Text size="sm">StyleMint order #{slip.orderNumber}</Text>
        </div>
        <Stack gap={0} align="flex-end">
          <Text size="sm" ff="monospace">
            {slip.packingSlipNumber}
          </Text>
          <Text size="xs">Ordered {formatDate(slip.placedUtc)}</Text>
          <Text size="xs">Printed {formatDateTime(slip.issuedUtc)}</Text>
        </Stack>
      </Group>
      <Divider my="md" color="#ccc" />
      <Text size="xs" tt="uppercase" fw={700}>
        Ship to
      </Text>
      <Text fw={650}>{a.receiverName}</Text>
      <Text size="sm">{a.receiverPhone}</Text>
      <Text size="sm">
        {[a.addressLine1, a.landmark].filter(Boolean).join(', ')}
      </Text>
      <Text size="sm">{[a.city, a.state, a.zipCode, a.country].filter(Boolean).join(', ')}</Text>
      {a.locationNote && (
        <Text size="sm" mt={4}>
          Note: {a.locationNote}
        </Text>
      )}
      {(slip.carrier || slip.trackingNumber) && (
        <Text size="sm" mt="sm">
          {slip.carrier} {slip.trackingNumber && <b>{slip.trackingNumber}</b>}
        </Text>
      )}
      <Table mt="md" withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item</Table.Th>
            <Table.Th>Variant</Table.Th>
            <Table.Th ta="right">Qty</Table.Th>
            <Table.Th ta="center">Packed</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {slip.items.map((item, i) => (
            <Table.Tr key={i}>
              <Table.Td>{item.productTitleSnapshot}</Table.Td>
              <Table.Td>{item.variantLabelSnapshot ?? '—'}</Table.Td>
              <Table.Td ta="right">{item.quantity}</Table.Td>
              <Table.Td ta="center">☐</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  );
}

/** Packing slips for one or more sub-orders, ready to print (the API returns data, not a PDF). */
export default function PackingSlipsPage() {
  const [params] = useSearchParams();
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean).slice(0, 100);
  const slips = useQuery({
    queryKey: ['orders', 'packing-slips', ids.join(',')],
    queryFn: async () => {
      if (ids.length === 1) return { slips: [await ordersApi.packingSlip(ids[0])], failed: 0 };
      const res = await ordersApi.bulkPackingSlips(ids);
      return {
        slips: res.items.filter((i) => i.success && i.value).map((i) => i.value as PackingSlip),
        failed: res.failureCount,
      };
    },
    enabled: ids.length > 0,
    staleTime: Infinity,
  });

  return (
    <>
      <div className="no-print">
        <PageHeader
          title={ids.length === 1 ? 'Packing slip' : `Packing slips (${ids.length})`}
          back={{ to: ids.length === 1 ? `/orders/${ids[0]}` : '/orders', label: ids.length === 1 ? 'Back to order' : 'Back to orders' }}
          actions={
            <Button leftSection={<IconPrinter size={16} />} onClick={() => window.print()} disabled={!slips.data?.slips.length}>
              Print
            </Button>
          }
        />
        {slips.data && slips.data.failed > 0 && (
          <Alert color="amber" variant="light" icon={<IconAlertTriangle size={16} />} mb="md">
            {slips.data.failed} packing {slips.data.failed === 1 ? 'slip' : 'slips'} could not be made (the order may be
            cancelled).
          </Alert>
        )}
      </div>
      {ids.length === 0 ? (
        <Text c="dimmed">No orders selected.</Text>
      ) : slips.isPending ? (
        <LoadingBlock label="Preparing packing slips…" />
      ) : slips.error ? (
        <ErrorBlock error={slips.error} onRetry={() => void slips.refetch()} title="Could not make the packing slips" />
      ) : (
        slips.data.slips.map((s) => <Slip key={s.packingSlipNumber} slip={s} />)
      )}
    </>
  );
}
