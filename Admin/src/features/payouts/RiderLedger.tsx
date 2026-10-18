import { Alert, Badge, Button, Group, Loader, SimpleGrid, Stack, Switch, Table, Tabs, Text } from '@mantine/core';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconCash } from '@tabler/icons-react';
import { ApiError } from '@/api/errors';
import {
  courierPayoutsApi,
  EARNING_STATUS,
  EARNING_TONE,
  LEDGER_KIND,
  LEDGER_STATE,
  PAYOUT_STATE,
  PAYOUT_TONE,
  type AdminCourierBalanceRow,
  type CourierBalance,
  type CourierEarningRow,
} from '@/api/money';
import { useAuth } from '@/auth/guards';
import { useActionDialog } from '@/components/ActionDialog';
import { IdText, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { FareAmount } from '@/components/FareBreakdown';
import { MetricTile } from '@/components/MetricTile';
import { EmptyBlock, ErrorBlock, NotAvailableBlock, SectionCard } from '@/components/StateBlocks';
import { useListState } from '@/hooks/useListState';
import { fmtMoney } from '@/lib/format';

const missing = (error: unknown) => error instanceof ApiError && error.isMissingEndpoint;

const NOT_DEPLOYED = 'The rider payout ledger (balances, cash to hand in, delivery fares) ships with the backend branch feat/rider-payout-ledger and fills in here once it is deployed.';

/**
 * Riders' money, largest cash-to-hand-in first: what each can be paid, what is still settling, and the COD / EMI cash
 * they collected at the door and have not handed in. Open one for the ledger behind it.
 */
export function RiderBalances() {
  const list = useListState(['owes'] as const);
  const owesCash = list.filters.owes === '1';
  const query = useQuery({
    queryKey: ['payouts', 'couriers', owesCash, list.page, list.pageSize],
    queryFn: ({ signal }) => courierPayoutsApi.balances(owesCash, list.page, Math.min(100, list.pageSize), signal),
    placeholderData: keepPreviousData,
  });
  if (missing(query.error)) return <NotAvailableBlock what="Rider balances" detail={NOT_DEPLOYED} />;

  const columns: Column<AdminCourierBalanceRow>[] = [
    { key: 'rider', header: 'Rider account', render: (r) => <IdText value={r.accountId} /> },
    {
      key: 'net',
      header: 'Net payable',
      align: 'right',
      render: (r) => (
        <Text size="sm" fw={600} c={r.netPayable < 0 ? 'signal' : undefined}>
          {fmtMoney(r.netPayable, r.currency)}
        </Text>
      ),
    },
    { key: 'available', header: 'Available', align: 'right', visibleFrom: 'sm', render: (r) => fmtMoney(r.availableEarnings, r.currency) },
    { key: 'pending', header: 'Pending', align: 'right', visibleFrom: 'md', render: (r) => fmtMoney(r.pendingEarnings, r.currency) },
    {
      key: 'cash',
      header: 'Cash to hand in',
      align: 'right',
      render: (r) =>
        r.cashToRemit > 0 ? (
          <Badge variant="light" color="amber">
            {fmtMoney(r.cashToRemit, r.currency)}
          </Badge>
        ) : (
          fmtMoney(0, r.currency)
        ),
    },
  ];
  return (
    <>
      <DataTable
        label="Rider balances"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(r) => r.accountId}
        onRowClick={(r) => list.open(r.accountId)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        filtered={owesCash}
        emptyTitle="No rider balances"
        emptyBody="No rider has earnings, pending fares or cash to hand in."
        toolbar={<Switch label="Only riders holding cash" checked={owesCash} onChange={(e) => list.setFilter('owes', e.currentTarget.checked ? '1' : null)} />}
      />
      <CourierLedgerDrawer accountId={list.selected} onClose={() => list.open(null)} />
    </>
  );
}

/** A rider's balance as tiles. Used in the ledger drawer and on the rider's own drawer. */
export function CourierBalanceTiles({ balance: b }: { balance: CourierBalance }) {
  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
        <MetricTile label={b.netPayable < 0 ? 'Owes the platform' : 'Net payable'} value={fmtMoney(Math.abs(b.netPayable), b.currency)} tone={b.netPayable < 0 ? 'signal' : 'forest'} hint="Available − cash to hand in" />
        <MetricTile label="Available" value={fmtMoney(b.availableEarnings, b.currency)} tone="gray" hint={`Lifetime ${fmtMoney(b.lifetimeEarnings, b.currency)}`} />
        <MetricTile
          label="Pending"
          value={fmtMoney(b.pendingEarnings, b.currency)}
          tone="gray"
          hint={b.onHoldEarnings > 0 ? `${fmtMoney(b.onHoldEarnings, b.currency)} on hold` : b.settleAfterHours != null ? `Settles after ${b.settleAfterHours} h` : undefined}
        />
        <MetricTile label="Cash to hand in" value={fmtMoney(b.cashToRemit, b.currency)} tone={b.cashToRemit > 0 ? 'amber' : 'gray'} hint="COD / EMI cash collected" />
      </SimpleGrid>
      {b.inFlightPayout && (
        <Alert variant="light" color="blue">
          A payout of {fmtMoney(b.inFlightPayout.netAmountValue, b.inFlightPayout.netAmountCurrency)} is {(PAYOUT_STATE[b.inFlightPayout.state] ?? 'in progress').toLowerCase()}.
        </Alert>
      )}
      {!b.hasDefaultDestination && (
        <Text size="xs" c="dimmed">
          No default payout method: the Friday batch skips this rider until they add one.
        </Text>
      )}
    </Stack>
  );
}

/** The rider's payout balance for the Riders drawer; says plainly when the ledger is not deployed. */
export function CourierBalanceSection({ accountId }: { accountId: string }) {
  const balance = useQuery({ queryKey: ['payouts', 'couriers', 'balance', accountId], queryFn: ({ signal }) => courierPayoutsApi.balance(accountId, signal), retry: false });
  return (
    <SectionCard title="Earnings & payouts" description="From the payout ledger. Escrow (the rider’s own deposit) is separate and not part of this.">
      {balance.isLoading ? (
        <Loader size="sm" />
      ) : missing(balance.error) ? (
        <NotAvailableBlock what="The rider payout ledger" detail={NOT_DEPLOYED} />
      ) : balance.error ? (
        <ErrorBlock error={balance.error} onRetry={() => void balance.refetch()} />
      ) : balance.data ? (
        <CourierBalanceTiles balance={balance.data} />
      ) : null}
    </SectionCard>
  );
}

function earningNote(e: CourierEarningRow) {
  if (e.status === 2) return e.holdReason ?? 'On hold';
  if (e.status === 1 && e.settleAfterUtc) return 'Settles after';
  return null;
}

export function CourierLedgerDrawer({ accountId, onClose }: { accountId: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const opened = !!accountId;
  const key = ['payouts', 'couriers', accountId] as const;
  const balance = useQuery({ queryKey: [...key, 'balance'], queryFn: ({ signal }) => courierPayoutsApi.balance(accountId!, signal), enabled: opened });
  const earnings = useQuery({ queryKey: [...key, 'earnings'], queryFn: ({ signal }) => courierPayoutsApi.earnings(accountId!, signal), enabled: opened });
  const ledger = useQuery({ queryKey: [...key, 'ledger'], queryFn: ({ signal }) => courierPayoutsApi.ledger(accountId!, signal), enabled: opened });
  const payouts = useQuery({ queryKey: [...key, 'payouts'], queryFn: ({ signal }) => courierPayoutsApi.payouts(accountId!, signal), enabled: opened });
  const done = () => void queryClient.invalidateQueries({ queryKey: ['payouts', 'couriers'] });
  const b = balance.data;
  const writes = can('riderLedger');

  return (
    <DetailDrawer
      opened={opened}
      onClose={onClose}
      title="Rider ledger"
      subtitle={accountId ? <IdText value={accountId} full /> : undefined}
      actions={
        writes &&
        b &&
        b.cashToRemit > 0 && (
          <Button
            size="sm"
            leftSection={<IconCash size={16} />}
            onClick={() =>
              open({
                title: 'Record cash handed in',
                consequence: `Records that the rider handed in cash they collected at the door. It comes off the ${fmtMoney(b.cashToRemit, b.currency)} they hold and stops it being taken from their next payout.`,
                confirmLabel: 'Record cash',
                fields: [
                  { name: 'amount', kind: 'number', label: `Amount (${b.currency})`, required: true, min: 1, max: b.cashToRemit, decimalScale: 2, defaultValue: String(b.cashToRemit) },
                  { name: 'reference', kind: 'text', label: 'Reference (deposit slip, receipt no.)', required: true, minLength: 2 },
                  { name: 'note', kind: 'textarea', label: 'Note' },
                ],
                run: (v) => courierPayoutsApi.recordCashRemittance(accountId!, { amount: Number(v.amount), reference: v.reference!.trim(), note: v.note?.trim() || null }),
                success: 'Cash recorded.',
                onDone: done,
              })
            }
          >
            Record cash handed in…
          </Button>
        )
      }
    >
      {dialog}
      {missing(balance.error) ? (
        <NotAvailableBlock what="The rider payout ledger" detail={NOT_DEPLOYED} />
      ) : (
        <Stack gap="lg">
          {balance.isLoading ? <Loader size="sm" /> : balance.error ? <ErrorBlock error={balance.error} onRetry={() => void balance.refetch()} /> : b ? <CourierBalanceTiles balance={b} /> : null}
          <Tabs defaultValue="deliveries" keepMounted={false}>
            <Tabs.List mb="sm">
              <Tabs.Tab value="deliveries">Deliveries</Tabs.Tab>
              <Tabs.Tab value="ledger">Ledger</Tabs.Tab>
              <Tabs.Tab value="payouts">Payouts</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="deliveries">
              {earnings.isLoading ? (
                <Loader size="sm" />
              ) : earnings.error ? (
                <ErrorBlock error={earnings.error} onRetry={() => void earnings.refetch()} />
              ) : !earnings.data || earnings.data.items.length === 0 ? (
                <EmptyBlock title="No deliveries yet" body="Completed legs and their fares appear here." />
              ) : (
                <Table.ScrollContainer minWidth={640}>
                  <Table aria-label="Delivery earnings">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Delivery</Table.Th>
                        <Table.Th>Completed</Table.Th>
                        <Table.Th>Fare</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Cash collected</Table.Th>
                        {writes && <Table.Th />}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {earnings.data.items.map((e) => (
                        <Table.Tr key={e.entryId || e.hopId}>
                          <Table.Td>{e.trackingNumber ? <span className="sm-mono">{e.trackingNumber}</span> : <IdText value={e.hopId} />}</Table.Td>
                          <Table.Td>
                            <When value={e.completedUtc} />
                          </Table.Td>
                          <Table.Td>
                            <FareAmount amount={e.amount} currency={e.currency} breakdown={e.fareBreakdown} />
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" color={EARNING_TONE[e.status] ?? 'gray'}>
                              {EARNING_STATUS[e.status] ?? e.status}
                            </Badge>
                            {earningNote(e) && (
                              <Text size="xs" c="dimmed">
                                {earningNote(e)} {e.status === 1 && e.settleAfterUtc ? <When value={e.settleAfterUtc} /> : null}
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>{e.cashCollected ? fmtMoney(e.cashCollected, e.currency) : '—'}</Table.Td>
                          {writes && (
                            <Table.Td>
                              <Group gap={4} wrap="nowrap">
                                {(e.status === 1 || e.status === 2) && (
                                  <Button
                                    size="compact-xs"
                                    variant="light"
                                    onClick={() =>
                                      open({
                                        title: 'Release this fare',
                                        consequence: `Settles ${fmtMoney(e.amount, e.currency)} now, so it counts towards the rider’s next payout${e.status === 2 ? ' even though the delivery is on hold' : ''}.`,
                                        confirmLabel: 'Release fare',
                                        fields: [{ name: 'note', kind: 'textarea', label: 'Why (kept in the audit log)', required: true, minLength: 5 }],
                                        run: (v) => courierPayoutsApi.releaseEarning(e.hopId, v.note!.trim()),
                                        success: 'Fare released.',
                                        onDone: done,
                                      })
                                    }
                                  >
                                    Release
                                  </Button>
                                )}
                                {e.status !== 4 && (
                                  <Button
                                    size="compact-xs"
                                    variant="subtle"
                                    color="signal"
                                    onClick={() =>
                                      open({
                                        title: 'Void this fare',
                                        consequence: `The rider is not paid ${fmtMoney(e.amount, e.currency)} for this delivery. A fare already settled is taken back from their balance.`,
                                        confirmLabel: 'Void fare',
                                        danger: true,
                                        fields: [{ name: 'reason', kind: 'textarea', label: 'Reason (the rider may see it)', required: true, minLength: 5 }],
                                        run: (v) => courierPayoutsApi.voidEarning(e.hopId, v.reason!.trim()),
                                        success: 'Fare voided.',
                                        onDone: done,
                                      })
                                    }
                                  >
                                    Void
                                  </Button>
                                )}
                              </Group>
                            </Table.Td>
                          )}
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Tabs.Panel>
            <Tabs.Panel value="ledger">
              {ledger.isLoading ? (
                <Loader size="sm" />
              ) : ledger.error ? (
                <ErrorBlock error={ledger.error} onRetry={() => void ledger.refetch()} />
              ) : !ledger.data || ledger.data.items.length === 0 ? (
                <EmptyBlock title="No ledger entries" />
              ) : (
                <Table.ScrollContainer minWidth={640}>
                  <Table aria-label="Ledger entries">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>When</Table.Th>
                        <Table.Th>Entry</Table.Th>
                        <Table.Th ta="right">Amount</Table.Th>
                        <Table.Th>State</Table.Th>
                        <Table.Th>Reference</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {ledger.data.items.map((l) => (
                        <Table.Tr key={l.id}>
                          <Table.Td>
                            <When value={l.occurredUtc} />
                          </Table.Td>
                          <Table.Td>{LEDGER_KIND[l.kind] ?? `Kind ${l.kind}`}</Table.Td>
                          <Table.Td ta="right" c={l.amountValue < 0 ? 'signal' : undefined} style={{ whiteSpace: 'nowrap' }}>
                            {fmtMoney(l.amountValue, l.amountCurrency)}
                          </Table.Td>
                          <Table.Td>{LEDGER_STATE[l.state] ?? l.state}</Table.Td>
                          <Table.Td>
                            <Text size="xs">{[l.trackingNumber, l.externalReference, l.holdReason, l.note].filter(Boolean).join(' · ') || '—'}</Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Tabs.Panel>
            <Tabs.Panel value="payouts">
              {payouts.isLoading ? (
                <Loader size="sm" />
              ) : payouts.error ? (
                <ErrorBlock error={payouts.error} onRetry={() => void payouts.refetch()} />
              ) : !payouts.data || payouts.data.items.length === 0 ? (
                <EmptyBlock title="No payouts yet" />
              ) : (
                <Table.ScrollContainer minWidth={560}>
                  <Table aria-label="Rider payouts">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Requested</Table.Th>
                        <Table.Th ta="right">Net</Table.Th>
                        <Table.Th>State</Table.Th>
                        <Table.Th>Reference / reason</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {payouts.data.items.map((p) => (
                        <Table.Tr key={p.id}>
                          <Table.Td>
                            <When value={p.requestedUtc} />
                          </Table.Td>
                          <Table.Td ta="right">{fmtMoney(p.netAmountValue, p.netAmountCurrency)}</Table.Td>
                          <Table.Td>
                            <Badge variant="light" color={PAYOUT_TONE[p.state]}>
                              {PAYOUT_STATE[p.state] ?? p.state}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs">{p.state === 4 ? (p.failureMessage ?? p.failureCode ?? '—') : (p.providerPayoutId ?? '—')}</Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}
    </DetailDrawer>
  );
}
