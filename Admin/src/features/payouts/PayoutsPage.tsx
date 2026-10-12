import { Alert, Badge, Button, Menu, Select, Stack, Text } from '@mantine/core';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconChevronDown, IconHandStop, IconPlayerPlay, IconShieldLock } from '@tabler/icons-react';
import { PAYEE_KIND, PAYOUT_DESTINATION, PAYOUT_MODE, PAYOUT_STATE, PAYOUT_TONE, payoutsApi, type Payout } from '@/api/money';
import { useAuth } from '@/auth/guards';
import { useActionDialog } from '@/components/ActionDialog';
import { FieldGrid, IdText, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/StateBlocks';
import { useListState } from '@/hooks/useListState';
import { fmtMoney, mask } from '@/lib/format';

/**
 * Creator and vendor payouts, newest first. Hold and release are routine; forcing a payout paid or failed overrides the
 * payment provider, so it is Super Admin only and asks for the authenticator again.
 */
export function PayoutsPage() {
  const list = useListState(['state'] as const);
  const query = useQuery({
    queryKey: ['payouts', list.filters.state, list.page, list.pageSize],
    queryFn: ({ signal }) => payoutsApi.queue(list.filters.state, list.page, Math.min(100, list.pageSize), signal),
    placeholderData: keepPreviousData,
  });
  const columns: Column<Payout>[] = [
    { key: 'payee', header: 'Payee', render: (p) => <TwoLine primary={PAYEE_KIND[p.payeeKind] ?? 'Payee'} secondary={<IdText value={p.payeeProfileId} />} /> },
    { key: 'net', header: 'Net', align: 'right', render: (p) => <Text size="sm" fw={600}>{fmtMoney(p.netAmountValue, p.netAmountCurrency)}</Text> },
    { key: 'dest', header: 'To', visibleFrom: 'md', render: (p) => PAYOUT_DESTINATION[p.destination] ?? '—' },
    {
      key: 'state',
      header: 'State',
      render: (p) => (
        <Badge variant="light" color={PAYOUT_TONE[p.state]}>
          {PAYOUT_STATE[p.state]}
        </Badge>
      ),
    },
    { key: 'requested', header: 'Requested', visibleFrom: 'sm', render: (p) => <When value={p.requestedUtc} relative /> },
    { key: 'release', header: 'Releases', visibleFrom: 'lg', render: (p) => <When value={p.pendingUntilUtc} /> },
  ];
  return (
    <>
      <PageHeader title="Payouts" description="Money owed to creators and vendors. Hold a payout you need to look into; release it when you’re done." />
      <DataTable
        label="Payouts"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(p) => p.id}
        onRowClick={(p) => list.open(p.id)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        filtered={!!list.filters.state}
        emptyTitle="No payouts"
        toolbar={
          <Select
            label="State"
            w={180}
            clearable
            placeholder="Any state"
            data={Object.entries(PAYOUT_STATE).map(([value, label]) => ({ value, label }))}
            value={list.filters.state || null}
            onChange={(v) => list.setFilter('state', v)}
          />
        }
      />
      <PayoutDrawer payout={query.data?.items.find((p) => p.id === list.selected) ?? null} opened={!!list.selected} onClose={() => list.open(null)} />
    </>
  );
}

function PayoutDrawer({ payout: p, opened, onClose }: { payout: Payout | null; opened: boolean; onClose: () => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const done = () => void queryClient.invalidateQueries({ queryKey: ['payouts'] });
  const reasonField = (max: number) => ({ name: 'reason', kind: 'textarea' as const, label: `Reason (kept in the audit log, ≤ ${max} characters)`, required: true, minLength: 5 });
  const tooLong = (v: string, max: number) => (v.trim().length > max ? Promise.reject(new Error(`Keep the reason under ${max} characters.`)) : null);

  return (
    <DetailDrawer
      opened={opened}
      onClose={onClose}
      title={p ? fmtMoney(p.netAmountValue, p.netAmountCurrency) : 'Payout'}
      subtitle={p ? `${PAYEE_KIND[p.payeeKind]} payout · ${PAYOUT_MODE[p.mode]}` : undefined}
      badges={
        p && (
          <Badge variant="light" color={PAYOUT_TONE[p.state]}>
            {PAYOUT_STATE[p.state]}
          </Badge>
        )
      }
      actions={
        p && (
          <>
            {can('holdPayouts') && p.state === 1 && (
              <Button
                size="sm"
                variant="light"
                color="amber"
                leftSection={<IconHandStop size={16} />}
                onClick={() =>
                  open({
                    title: 'Hold this payout',
                    consequence: 'It will not be sent until released. The payee sees it as on hold.',
                    confirmLabel: 'Hold payout',
                    fields: [reasonField(200)],
                    run: (v) => tooLong(v.reason!, 200) ?? payoutsApi.hold(p.id, v.reason!.trim()),
                    success: 'Payout held.',
                    onDone: done,
                  })
                }
              >
                Hold
              </Button>
            )}
            {can('holdPayouts') && p.state === 5 && (
              <Button
                size="sm"
                leftSection={<IconPlayerPlay size={16} />}
                onClick={() =>
                  open({
                    title: 'Release this payout',
                    consequence: 'It goes back into the queue and is sent on its normal schedule.',
                    confirmLabel: 'Release payout',
                    fields: [reasonField(1000)],
                    run: (v) => payoutsApi.release(p.id, v.reason!.trim()),
                    success: 'Payout released.',
                    onDone: done,
                  })
                }
              >
                Release
              </Button>
            )}
            {can('forcePayouts') && p.state !== 3 && (
              <Menu position="bottom-end">
                <Menu.Target>
                  <Button size="sm" variant="default" rightSection={<IconChevronDown size={14} />} leftSection={<IconShieldLock size={16} />}>
                    Override
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  {p.state !== 4 && (
                    <Menu.Item
                      onClick={() =>
                        open({
                          title: 'Mark as paid manually',
                          consequence: 'Records the payout as paid outside the provider (for example a bank transfer you made). The payee is told it is paid. Needs your authenticator code.',
                          confirmLabel: 'Mark paid',
                          danger: true,
                          fields: [reasonField(500)],
                          run: (v) => tooLong(v.reason!, 500) ?? payoutsApi.forcePaid(p.id, v.reason!.trim()),
                          success: 'Marked as paid.',
                          onDone: done,
                        })
                      }
                    >
                      Mark as paid…
                    </Menu.Item>
                  )}
                  <Menu.Item
                    color="signal"
                    onClick={() =>
                      open({
                        title: 'Mark as failed',
                        consequence: 'Stops the payout for good; the amount returns to the payee’s balance. Needs your authenticator code.',
                        confirmLabel: 'Mark failed',
                        danger: true,
                        fields: [reasonField(500)],
                        run: (v) => tooLong(v.reason!, 500) ?? payoutsApi.forceFailed(p.id, v.reason!.trim()),
                        success: 'Marked as failed.',
                        onDone: done,
                      })
                    }
                  >
                    Mark as failed…
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </>
        )
      }
    >
      {dialog}
      {!p ? (
        <Text size="sm" c="dimmed">
          This payout isn’t on the current page any more.
        </Text>
      ) : (
        <Stack gap="lg">
          {p.failureCode && (
            <Alert color="signal" variant="light" title="Failed">
              {p.failureMessage ?? p.failureCode}
            </Alert>
          )}
          <SectionCard title="Amounts">
            <FieldGrid
              cols={3}
              fields={[
                { label: 'Requested', value: fmtMoney(p.requestedAmountValue, p.requestedAmountCurrency) },
                { label: 'Fee', value: fmtMoney(p.feeAmountValue, p.feeAmountCurrency) },
                { label: 'Net to payee', value: fmtMoney(p.netAmountValue, p.netAmountCurrency) },
              ]}
            />
          </SectionCard>
          <SectionCard title="Details">
            <FieldGrid
              fields={[
                { label: 'Destination', value: PAYOUT_DESTINATION[p.destination] },
                { label: 'Account', value: <span className="sm-mono">{mask(p.destinationRef)}</span> },
                { label: 'Mode', value: PAYOUT_MODE[p.mode] },
                { label: 'Requested', value: <When value={p.requestedUtc} /> },
                { label: 'Releases after', value: <When value={p.pendingUntilUtc} /> },
                { label: 'Paid', value: <When value={p.paidUtc} /> },
                { label: 'Provider reference', value: p.providerPayoutId },
                { label: 'Payee profile', value: <IdText value={p.payeeProfileId} /> },
                { label: 'Payout ID', value: <IdText value={p.id} /> },
              ]}
            />
          </SectionCard>
        </Stack>
      )}
    </DetailDrawer>
  );
}
