import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Group, Menu, Select, Stack, Tabs, Text } from '@mantine/core';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconBuildingBank, IconCash, IconCheck, IconChevronDown, IconEye, IconHandStop, IconList, IconMotorbike, IconPlayerPlay, IconShieldLock, IconX } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, messageOf } from '@/api/errors';
import {
  AWAITING_TRANSFER,
  PAYEE_KIND,
  PAYOUT_DESTINATION,
  PAYOUT_MODE,
  PAYOUT_STATE,
  PAYOUT_TONE,
  payoutsApi,
  type Payout,
  type PayoutTransferDetail,
} from '@/api/money';
import type { Page } from '@/api/paging';
import { useAuth } from '@/auth/guards';
import { withStepUp } from '@/auth/stepUp';
import { useActionDialog } from '@/components/ActionDialog';
import { FieldGrid, IdText, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/StateBlocks';
import { useListState } from '@/hooks/useListState';
import { fmtMoney, mask } from '@/lib/format';
import { RiderBalances } from './RiderLedger';

const ROLE_OPTIONS = Object.entries(PAYEE_KIND).map(([value, label]) => ({ value, label }));

/**
 * The server filters by `role` only once the rider-payout backend is deployed; before that it ignores the parameter
 * and returns every payee. Rows of another role are dropped here so "Courier" never shows a creator's payout, and the
 * screen says why the page may hold fewer rows.
 */
function byRole(page: Page<Payout> | undefined, role: string): { page: Page<Payout> | undefined; ignored: boolean } {
  if (!page || !role) return { page, ignored: false };
  const kind = Number(role);
  const items = page.items.filter((p) => p.payeeKind === kind);
  return { page: { ...page, items }, ignored: items.length !== page.items.length };
}

function RoleIgnored() {
  return (
    <Alert variant="light" color="slate" mb="sm" data-testid="role-filter-ignored">
      This server doesn’t filter payouts by role yet, so only the matching rows of each page are shown. Pages may look short until the rider-payout update is deployed.
    </Alert>
  );
}

/**
 * Creator, vendor and courier (rider) payouts. Hold and release are routine; on a manual-transfer server the finance
 * desk works the "Awaiting transfer" list - send the money, then mark it paid with the bank reference, or mark it
 * failed. Forcing a payout paid or failed overrides the payment provider, so it is Super Admin only and asks for the
 * authenticator again. Riders also have their own balances: earnings, cash they collected and must hand in, payouts.
 */
export function PayoutsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'queue';
  return (
    <>
      <PageHeader title="Payouts" description="Money owed to creators, vendors and riders. Send what is awaiting transfer, hold a payout you need to look into, and keep riders’ cash in check." />
      <Tabs value={tab} onChange={(v) => v && setParams(new URLSearchParams({ tab: v }), { replace: true })} keepMounted={false} variant="outline">
        <Tabs.List mb="md">
          <Tabs.Tab value="queue" leftSection={<IconList size={16} />}>
            All payouts
          </Tabs.Tab>
          <Tabs.Tab value="transfer" leftSection={<IconBuildingBank size={16} />}>
            Awaiting transfer
          </Tabs.Tab>
          <Tabs.Tab value="riders" leftSection={<IconMotorbike size={16} />}>
            Rider balances
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="queue">
          <PayoutQueue />
        </Tabs.Panel>
        <Tabs.Panel value="transfer">
          <AwaitingTransfer />
        </Tabs.Panel>
        <Tabs.Panel value="riders">
          <RiderBalances />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}

function payoutColumns(): Column<Payout>[] {
  return [
    { key: 'payee', header: 'Payee', render: (p) => <TwoLine primary={PAYEE_KIND[p.payeeKind] ?? 'Payee'} secondary={<IdText value={p.payeeProfileId} />} /> },
    { key: 'net', header: 'Net', align: 'right', render: (p) => <Text size="sm" fw={600}>{fmtMoney(p.netAmountValue, p.netAmountCurrency)}</Text> },
    { key: 'dest', header: 'To', visibleFrom: 'md', render: (p) => `${PAYOUT_DESTINATION[p.destination] ?? '—'} ${p.destinationRef ? mask(p.destinationRef) : ''}`.trim() },
    {
      key: 'state',
      header: 'State',
      render: (p) => (
        <Badge variant="light" color={PAYOUT_TONE[p.state]}>
          {PAYOUT_STATE[p.state] ?? p.state}
        </Badge>
      ),
    },
    { key: 'requested', header: 'Requested', visibleFrom: 'sm', render: (p) => <When value={p.requestedUtc} relative /> },
    { key: 'release', header: 'Releases', visibleFrom: 'lg', render: (p) => <When value={p.pendingUntilUtc} /> },
  ];
}

function RoleSelect({ value, onChange }: { value: string; onChange: (v: string | null) => void }) {
  return <Select label="Role" w={160} clearable placeholder="Any role" data={ROLE_OPTIONS} value={value || null} onChange={onChange} />;
}

function PayoutQueue() {
  const list = useListState(['state', 'role'] as const);
  const query = useQuery({
    queryKey: ['payouts', 'queue', list.filters.state, list.filters.role, list.page, list.pageSize],
    queryFn: ({ signal }) => payoutsApi.queue(list.filters.state, list.page, Math.min(100, list.pageSize), signal, list.filters.role),
    placeholderData: keepPreviousData,
  });
  const { page, ignored } = byRole(query.data, list.filters.role);
  return (
    <>
      {ignored && <RoleIgnored />}
      <DataTable
        label="Payouts"
        columns={payoutColumns()}
        page={page}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(p) => p.id}
        onRowClick={(p) => list.open(p.id)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        filtered={!!list.filters.state || !!list.filters.role}
        emptyTitle="No payouts"
        toolbar={
          <Group gap="sm" align="flex-end">
            <Select
              label="State"
              w={180}
              clearable
              placeholder="Any state"
              data={Object.entries(PAYOUT_STATE).map(([value, label]) => ({ value, label }))}
              value={list.filters.state || null}
              onChange={(v) => list.setFilter('state', v)}
            />
            <RoleSelect value={list.filters.role} onChange={(v) => list.setFilter('role', v)} />
          </Group>
        }
      />
      <PayoutDrawer payout={page?.items.find((p) => p.id === list.selected) ?? null} opened={!!list.selected} onClose={() => list.open(null)} />
    </>
  );
}

function AwaitingTransfer() {
  const list = useListState(['role'] as const);
  const query = useQuery({
    queryKey: ['payouts', 'awaiting-transfer', list.filters.role, list.page, list.pageSize],
    queryFn: ({ signal }) => payoutsApi.awaitingTransfer(list.filters.role, list.page, Math.min(100, list.pageSize), signal),
    placeholderData: keepPreviousData,
  });
  const { page, ignored } = byRole(query.data, list.filters.role);
  return (
    <>
      {ignored && <RoleIgnored />}
      <DataTable
        label="Payouts awaiting transfer"
        columns={payoutColumns()}
        page={page}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(p) => p.id}
        onRowClick={(p) => list.open(p.id)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        filtered={!!list.filters.role}
        emptyTitle="Nothing to send"
        emptyBody="No payout is waiting for a manual transfer."
        toolbar={<RoleSelect value={list.filters.role} onChange={(v) => list.setFilter('role', v)} />}
      />
      <PayoutDrawer payout={page?.items.find((p) => p.id === list.selected) ?? null} opened={!!list.selected} onClose={() => list.open(null)} />
    </>
  );
}

export function PayoutDrawer({ payout: p, opened, onClose }: { payout: Payout | null; opened: boolean; onClose: () => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const [detail, setDetail] = useState<PayoutTransferDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  // The unmasked account number is never kept beyond the payout it was opened for.
  useEffect(() => {
    setDetail(null);
    setDetailError(null);
  }, [p?.id]);
  const done = () => void queryClient.invalidateQueries({ queryKey: ['payouts'] });
  const reasonField = (max: number) => ({ name: 'reason', kind: 'textarea' as const, label: `Reason (kept in the audit log, ≤ ${max} characters)`, required: true, minLength: 5 });
  const tooLong = (v: string, max: number) => (v.trim().length > max ? Promise.reject(new Error(`Keep the reason under ${max} characters.`)) : null);
  const awaiting = p?.state === AWAITING_TRANSFER;

  const reveal = async () => {
    if (!p) return;
    setRevealing(true);
    setDetailError(null);
    try {
      setDetail(await withStepUp(() => payoutsApi.transferDetail(p.id)));
    } catch (e) {
      setDetailError(e instanceof ApiError && e.isMissingEndpoint ? 'Transfer details aren’t available on this server yet.' : messageOf(e));
    } finally {
      setRevealing(false);
    }
  };

  return (
    <DetailDrawer
      opened={opened}
      onClose={onClose}
      title={p ? fmtMoney(p.netAmountValue, p.netAmountCurrency) : 'Payout'}
      subtitle={p ? `${PAYEE_KIND[p.payeeKind] ?? 'Payee'} payout · ${PAYOUT_MODE[p.mode] ?? ''}` : undefined}
      badges={
        p && (
          <Badge variant="light" color={PAYOUT_TONE[p.state]}>
            {PAYOUT_STATE[p.state] ?? p.state}
          </Badge>
        )
      }
      actions={
        p && (
          <>
            {can('transferPayouts') && awaiting && (
              <>
                <Button
                  size="sm"
                  leftSection={<IconCheck size={16} />}
                  onClick={() =>
                    open({
                      title: 'Mark as paid',
                      consequence: `Records that you sent ${fmtMoney(p.netAmountValue, p.netAmountCurrency)} by hand. The payee is told it is paid and sees the reference. Needs your authenticator code.`,
                      confirmLabel: 'Mark paid',
                      fields: [
                        { name: 'reference', kind: 'text', label: 'Bank / wallet transfer reference', required: true, minLength: 3, placeholder: 'UTR or transaction id' },
                        { name: 'note', kind: 'textarea', label: 'Note (who sent it, from which account)', required: true, minLength: 3 },
                      ],
                      run: (v) => payoutsApi.markPaid(p.id, v.reference!.trim(), v.note!.trim()),
                      success: 'Marked as paid.',
                      onDone: done,
                    })
                  }
                >
                  Mark paid…
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  color="signal"
                  leftSection={<IconX size={16} />}
                  onClick={() =>
                    open({
                      title: 'Mark as failed',
                      consequence: 'The transfer could not be made. The payout and any fee are reversed, so the money is back in the payee’s balance.',
                      confirmLabel: 'Mark failed',
                      danger: true,
                      fields: [reasonField(500)],
                      run: (v) => tooLong(v.reason!, 500) ?? payoutsApi.markFailed(p.id, v.reason!.trim()),
                      success: 'Marked as failed.',
                      onDone: done,
                    })
                  }
                >
                  Mark failed…
                </Button>
              </>
            )}
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
                          title: 'Force as paid',
                          consequence: 'Overrides the payment provider and records the payout as paid. The payee is told it is paid. Needs your authenticator code.',
                          confirmLabel: 'Force paid',
                          danger: true,
                          fields: [reasonField(500)],
                          run: (v) => tooLong(v.reason!, 500) ?? payoutsApi.forcePaid(p.id, v.reason!.trim()),
                          success: 'Marked as paid.',
                          onDone: done,
                        })
                      }
                    >
                      Force paid…
                    </Menu.Item>
                  )}
                  <Menu.Item
                    color="signal"
                    onClick={() =>
                      open({
                        title: 'Force as failed',
                        consequence: 'Stops the payout for good; the amount returns to the payee’s balance. Needs your authenticator code.',
                        confirmLabel: 'Force failed',
                        danger: true,
                        fields: [reasonField(500)],
                        run: (v) => tooLong(v.reason!, 500) ?? payoutsApi.forceFailed(p.id, v.reason!.trim()),
                        success: 'Marked as failed.',
                        onDone: done,
                      })
                    }
                  >
                    Force failed…
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
          {awaiting && can('transferPayouts') && (
            <SectionCard
              title="Send the money"
              description="The full account number is shown only on request, asks for your authenticator, and the viewing is audited."
              action={
                !detail && (
                  <Button size="xs" variant="light" leftSection={<IconEye size={14} />} loading={revealing} onClick={() => void reveal()}>
                    Show account details
                  </Button>
                )
              }
            >
              {detailError && (
                <Alert color="signal" variant="light" mb="sm">
                  {detailError}
                </Alert>
              )}
              {detail ? (
                <FieldGrid
                  fields={[
                    { label: 'Send', value: fmtMoney(detail.netAmount, detail.currency) },
                    { label: 'To', value: PAYOUT_DESTINATION[detail.destination] },
                    { label: 'Account', value: <span className="sm-mono">{detail.accountIdentifier}</span> },
                    { label: 'Branch / IFSC', value: detail.branchOrIfsc },
                    { label: 'Saved as', value: detail.destinationLabel },
                    { label: 'Verified', value: detail.destinationVerified == null ? null : detail.destinationVerified ? 'Yes' : 'No' },
                  ]}
                />
              ) : (
                <Text size="sm" c="dimmed">
                  <IconCash size={14} style={{ verticalAlign: 'middle' }} /> {fmtMoney(p.netAmountValue, p.netAmountCurrency)} to {PAYOUT_DESTINATION[p.destination] ?? 'the payee'} {mask(p.destinationRef)}
                </Text>
              )}
            </SectionCard>
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
                { label: 'Payee', value: PAYEE_KIND[p.payeeKind] },
                { label: 'Destination', value: PAYOUT_DESTINATION[p.destination] },
                { label: 'Account', value: <span className="sm-mono">{mask(p.destinationRef)}</span> },
                { label: 'Mode', value: PAYOUT_MODE[p.mode] },
                { label: 'Requested', value: <When value={p.requestedUtc} /> },
                { label: 'Releases after', value: <When value={p.pendingUntilUtc} /> },
                { label: 'Paid', value: <When value={p.paidUtc} /> },
                { label: 'Transfer reference', value: p.providerPayoutId },
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
