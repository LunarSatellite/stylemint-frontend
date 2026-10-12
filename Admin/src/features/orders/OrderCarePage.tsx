import { Badge, Group, Progress, SegmentedControl, Skeleton, Stack, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CARE_LABEL, ordersApi } from '@/api/orders';
import { When } from '@/components/Bits';
import { PageHeader } from '@/components/PageHeader';
import { EmptyBlock, ErrorBlock, SectionCard } from '@/components/StateBlocks';
import { humanize } from '@/lib/format';

/** Where orders are going wrong, by theme: counts of open problems in the window, largest first. */
export function OrderCarePage() {
  const [params, setParams] = useSearchParams();
  const days = Number(params.get('days')) || 30;
  const query = useQuery({ queryKey: ['order-care', days], queryFn: ({ signal }) => ordersApi.careThemes(days, signal) });
  const max = Math.max(1, ...(query.data?.themes.map((t) => t.openCount) ?? [1]));
  return (
    <>
      <PageHeader
        title="Order care"
        description="Open problems across orders, grouped by what went wrong and who owns fixing it. Counts only - the backend deliberately reports no rates."
        actions={
          <SegmentedControl
            value={String(days)}
            onChange={(v) => setParams(new URLSearchParams({ days: v }), { replace: true })}
            data={[
              { value: '7', label: '7 days' },
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
            ]}
            aria-label="Window"
          />
        }
      />
      <SectionCard title="Themes" description={query.data ? <>Generated <When value={query.data.generatedUtc} relative /></> : undefined}>
        {query.isLoading ? (
          <Stack>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={28} radius="sm" />
            ))}
          </Stack>
        ) : query.error ? (
          <ErrorBlock error={query.error} onRetry={() => void query.refetch()} />
        ) : !query.data || query.data.themes.length === 0 ? (
          <EmptyBlock title="Nothing open" body="No order problems were found in this window." />
        ) : (
          <Table aria-label="Order care themes">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Theme</Table.Th>
                <Table.Th>Owner</Table.Th>
                <Table.Th style={{ width: '40%' }}>Open</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {query.data.themes.map((t) => (
                <Table.Tr key={t.code}>
                  <Table.Td>{CARE_LABEL[t.code] ?? humanize(t.code)}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="slate">
                      {humanize(t.accountableArea)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap">
                      <Progress value={(t.openCount / max) * 100} color={t.openCount ? 'amber' : 'forest'} style={{ flex: 1 }} aria-hidden />
                      <Text size="sm" fw={600} w={48} ta="right">
                        {t.openCount}
                      </Text>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </SectionCard>
    </>
  );
}
