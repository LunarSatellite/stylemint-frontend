import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Menu,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import { IconBuildingBank, IconCash, IconDots, IconPlus, IconStar, IconTrash, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, messageOf } from '../../api/client';
import { useCursorList } from '../../api/useCursorList';
import { KpiTile } from '../../components/KpiTile';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDate, formatDateTime, formatMoney } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import { useIsPhone } from '../../lib/useIsPhone';
import {
  destinationKindLabel,
  isBankKind,
  ledgerKindLabel,
  ledgerStateLabel,
  PAYOUT_HOLD_DAYS,
  PAYOUT_MAX,
  PAYOUT_MIN,
  payoutFee,
  payoutsApi,
  platformCommissionText,
  PayoutState,
  payoutStateColor,
  payoutStateLabel,
  type LedgerEntry,
  type PayoutDestination,
} from './api';

function payoutError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.problem?.field === 'PAYOUT_IN_FLIGHT') return 'You already have a payout on its way. Wait for it to finish before asking for another.';
    if (e.problem?.field === 'rule.insufficient_balance' || e.code === 'rule.insufficient_balance') return 'Your available balance is not enough for this amount.';
  }
  return messageOf(e);
}

function RequestPayoutModal({
  opened,
  onClose,
  available,
  currency,
  destinations,
}: {
  opened: boolean;
  onClose: () => void;
  available: number;
  currency: string;
  destinations: PayoutDestination[];
}) {
  const qc = useQueryClient();
  const max = Math.min(PAYOUT_MAX, Math.floor(available));
  const [amount, setAmount] = useState<number>(max);
  const [destinationId, setDestinationId] = useState<string | null>(destinations.find((d) => d.isDefault)?.id ?? destinations[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const request = useMutation({
    mutationFn: () => payoutsApi.requestPayout(destinationId!, amount),
    onSuccess: () => {
      toastSuccess(`Payout requested. It is sent after a ${PAYOUT_HOLD_DAYS}-day hold.`);
      void qc.invalidateQueries({ queryKey: ['payouts'] });
      void qc.invalidateQueries({ queryKey: ['home', 'balance'] });
      onClose();
    },
    onError: (e) => setError(payoutError(e)),
  });
  const fee = payoutFee(amount || 0);
  const submit = () => {
    setError(null);
    if (!destinationId) return setError('Choose where to send the money.');
    if (amount < PAYOUT_MIN) return setError(`The minimum payout is ${formatMoney(PAYOUT_MIN)}.`);
    if (amount > max) return setError(`You can take out at most ${formatMoney(max)} now.`);
    request.mutate();
  };
  return (
    <Modal opened={opened} onClose={onClose} title="Request a payout">
      <Stack gap="md">
        {error && (
          <Alert color="signal" variant="light" role="alert">
            {error}
          </Alert>
        )}
        <Select
          label="Send to"
          data={destinations.map((d) => ({ value: d.id, label: `${d.label} · ${destinationKindLabel[d.kind] ?? ''} ${d.accountIdentifierMasked}` }))}
          value={destinationId}
          onChange={setDestinationId}
          allowDeselect={false}
        />
        <NumberInput
          label={`Amount (${currency === 'NPR' ? 'Rs' : currency})`}
          description={`Between ${formatMoney(PAYOUT_MIN)} and ${formatMoney(max)}`}
          value={amount}
          onChange={(v) => setAmount(Number(v) || 0)}
          min={PAYOUT_MIN}
          max={max}
          thousandSeparator=","
          decimalScale={2}
        />
        <Card padding="sm" withBorder>
          <Group justify="space-between">
            <Text size="sm">Fee (2%)</Text>
            <Text size="sm">{formatMoney({ amount: fee, currency }, { decimals: 2 })}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" fw={650}>
              You receive
            </Text>
            <Text size="sm" fw={650}>
              {formatMoney({ amount: Math.max(0, (amount || 0) - fee), currency }, { decimals: 2 })}
            </Text>
          </Group>
        </Card>
        <Text size="xs" c="dimmed">
          Payouts are held for {PAYOUT_HOLD_DAYS} days in case of returns, then sent. Only one payout can be in progress at a time.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={request.isPending}>
            Request payout
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function AddDestinationModal({ opened, onClose, first }: { opened: boolean; onClose: () => void; first: boolean }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<string | null>('4');
  const [label, setLabel] = useState('');
  const [account, setAccount] = useState('');
  const [branch, setBranch] = useState('');
  const [makeDefault, setMakeDefault] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bank = isBankKind(Number(kind));
  const add = useMutation({
    mutationFn: () =>
      payoutsApi.addDestination({
        kind: Number(kind),
        label: label.trim(),
        accountIdentifier: account.trim(),
        branchOrIfsc: bank ? branch.trim() : null,
        makeDefault: first || makeDefault,
      }),
    onSuccess: () => {
      toastSuccess('Payout account added');
      void qc.invalidateQueries({ queryKey: ['payouts', 'destinations'] });
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const submit = () => {
    setError(null);
    if (!label.trim()) return setError('Give this account a name you recognise.');
    if (!account.trim()) return setError(bank ? 'Enter the account number.' : 'Enter the eSewa ID or PayPal email.');
    if (bank && !branch.trim()) return setError('Enter the bank branch.');
    add.mutate();
  };
  return (
    <Modal opened={opened} onClose={onClose} title="Add a payout account">
      <Stack gap="md">
        {error && (
          <Alert color="signal" variant="light" role="alert">
            {error}
          </Alert>
        )}
        <Select
          label="Type"
          data={Object.entries(destinationKindLabel).map(([value, l]) => ({ value, label: l }))}
          value={kind}
          onChange={setKind}
          allowDeselect={false}
        />
        <TextInput label="Name" placeholder="e.g. Shop eSewa" maxLength={100} value={label} onChange={(e) => setLabel(e.currentTarget.value)} />
        <TextInput
          label={bank ? 'Account number' : Number(kind) === 4 ? 'eSewa ID (mobile number)' : 'PayPal email'}
          maxLength={200}
          value={account}
          onChange={(e) => setAccount(e.currentTarget.value)}
        />
        {bank && <TextInput label="Branch" maxLength={100} value={branch} onChange={(e) => setBranch(e.currentTarget.value)} />}
        {!first && <Checkbox label="Use for future payouts" checked={makeDefault} onChange={(e) => setMakeDefault(e.currentTarget.checked)} />}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={add.isPending}>
            Add account
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function PayoutsList() {
  const qc = useQueryClient();
  const isPhone = useIsPhone();
  const list = useCursorList({ key: ['payouts', 'list'], fetchPage: payoutsApi.payouts });
  const cancel = useMutation({
    mutationFn: (id: string) => payoutsApi.cancelPayout(id),
    onSuccess: () => {
      toastSuccess('Payout cancelled');
      void qc.invalidateQueries({ queryKey: ['payouts'] });
    },
    onError: (e) => toastError(e, 'Could not cancel'),
  });
  const onCancel = async (id: string) => {
    if (await confirmAction({ title: 'Cancel this payout?', body: 'The money goes back to your available balance.', confirmLabel: 'Cancel payout', danger: true, cancelLabel: 'Keep it' }))
      cancel.mutate(id);
  };
  if (list.query.isPending) return <ListSkeleton rows={3} />;
  if (list.query.error) return <ErrorBlock error={list.query.error} onRetry={() => void list.query.refetch()} title="Could not load payouts" />;
  const items = list.query.data?.items ?? [];
  return (
    <>
      {items.length === 0 ? (
        <EmptyBlock title="No payouts yet" body="When you request a payout, it shows here with its status." />
      ) : isPhone ? (
        <Stack gap="xs">
          {items.map((p) => (
            <Card key={p.id} padding="sm" withBorder>
              <Group justify="space-between">
                <div>
                  <Text fw={650}>{formatMoney({ amount: p.netAmountValue, currency: p.netAmountCurrency })}</Text>
                  <Text size="xs" c="dimmed">
                    {formatDate(p.requestedUtc)} · {destinationKindLabel[p.destination] ?? ''} {p.destinationRef}
                  </Text>
                </div>
                <Group gap={4}>
                  <Badge color={payoutStateColor[p.state]} variant="light">
                    {payoutStateLabel[p.state]}
                  </Badge>
                  {p.state === PayoutState.Requested && (
                    <ActionIcon variant="subtle" color="signal" onClick={() => void onCancel(p.id)} aria-label="Cancel payout">
                      <IconX size={14} />
                    </ActionIcon>
                  )}
                </Group>
              </Group>
              {p.failureMessage && (
                <Text size="xs" c="signal" mt={4}>
                  {p.failureMessage}
                </Text>
              )}
            </Card>
          ))}
        </Stack>
      ) : (
        <Table.ScrollContainer minWidth={640}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Requested</Table.Th>
                <Table.Th>To</Table.Th>
                <Table.Th ta="right">Amount</Table.Th>
                <Table.Th ta="right">Fee</Table.Th>
                <Table.Th ta="right">You receive</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>{formatDate(p.requestedUtc)}</Table.Td>
                  <Table.Td>
                    {destinationKindLabel[p.destination] ?? ''} {p.destinationRef}
                  </Table.Td>
                  <Table.Td ta="right">{formatMoney({ amount: p.requestedAmountValue, currency: p.requestedAmountCurrency })}</Table.Td>
                  <Table.Td ta="right">{formatMoney({ amount: p.feeAmountValue, currency: p.requestedAmountCurrency }, { decimals: 2 })}</Table.Td>
                  <Table.Td ta="right" fw={650}>
                    {formatMoney({ amount: p.netAmountValue, currency: p.netAmountCurrency }, { decimals: 2 })}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={payoutStateColor[p.state]} variant="light">
                      {payoutStateLabel[p.state]}
                    </Badge>
                    {p.state === PayoutState.Requested && (
                      <Text size="xs" c="dimmed">
                        Sent after {formatDate(p.pendingUntilUtc)}
                      </Text>
                    )}
                    {p.failureMessage && (
                      <Text size="xs" c="signal">
                        {p.failureMessage}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {p.state === PayoutState.Requested && (
                      <Button size="xs" variant="subtle" color="signal" onClick={() => void onCancel(p.id)}>
                        Cancel
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      <Pager page={list.page} pageSize={list.pageSize} total={null} shown={items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} busy={list.query.isFetching} />
    </>
  );
}

/** On a sale row: how much StyleMint's platform commission took out of it. Nothing when the row has none (or an older API). */
function PlatformCommissionNote({ entry }: { entry: LedgerEntry }) {
  const text = platformCommissionText(entry, (amount, currency) => formatMoney({ amount, currency }, { decimals: 2 }));
  if (!text) return null;
  return (
    <Text size="xs" c="dimmed" data-testid="entry-platform-commission">
      {text}
    </Text>
  );
}

function EntriesList() {
  const list = useCursorList({ key: ['payouts', 'entries'], fetchPage: payoutsApi.entries });
  if (list.query.isPending) return <ListSkeleton rows={4} height={44} />;
  if (list.query.error) return <ErrorBlock error={list.query.error} onRetry={() => void list.query.refetch()} title="Could not load earnings" />;
  const items = list.query.data?.items ?? [];
  return (
    <>
      {items.length === 0 ? (
        <EmptyBlock title="No earnings yet" body="Each delivered order adds an entry here." />
      ) : (
        <Stack gap={0}>
          {items.map((e) => (
            <Group key={e.id} justify="space-between" py="xs" wrap="nowrap" style={{ borderBottom: '1px solid var(--sm-row-line)' }}>
              <div style={{ minWidth: 0 }}>
                <Text size="sm" fw={600}>
                  {ledgerKindLabel[e.kind] ?? 'Entry'}
                  {e.note ? ` · ${e.note}` : ''}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatDateTime(e.occurredUtc)} · {ledgerStateLabel[e.state] ?? ''}
                </Text>
                <PlatformCommissionNote entry={e} />
              </div>
              <Text size="sm" fw={650} c={e.amountValue < 0 ? 'var(--sm-danger-text)' : 'var(--sm-good-text)'} style={{ flexShrink: 0 }}>
                {e.amountValue > 0 ? '+' : ''}
                {formatMoney({ amount: e.amountValue, currency: e.amountCurrency }, { decimals: 2 })}
              </Text>
            </Group>
          ))}
        </Stack>
      )}
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} shown={items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} busy={list.query.isFetching} />
    </>
  );
}

function DestinationsList({ destinations, onAdd }: { destinations: PayoutDestination[]; onAdd: () => void }) {
  const qc = useQueryClient();
  const makeDefault = useMutation({
    mutationFn: (id: string) => payoutsApi.makeDefault(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['payouts', 'destinations'] }),
    onError: (e) => toastError(e),
  });
  const remove = useMutation({
    mutationFn: (id: string) => payoutsApi.removeDestination(id),
    onSuccess: () => {
      toastSuccess('Payout account removed');
      void qc.invalidateQueries({ queryKey: ['payouts', 'destinations'] });
    },
    onError: (e) => toastError(e),
  });
  if (destinations.length === 0)
    return (
      <EmptyBlock
        title="No payout account yet"
        body="Add your eSewa or bank account to receive your money."
        action={
          <Button leftSection={<IconPlus size={16} />} onClick={onAdd} mt="sm">
            Add payout account
          </Button>
        }
      />
    );
  return (
    <Stack gap="xs">
      {destinations.map((d) => (
        <Card key={d.id} padding="sm" withBorder>
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
              <IconBuildingBank size={22} color="var(--sm-accent)" />
              <div style={{ minWidth: 0 }}>
                <Group gap={6}>
                  <Text fw={600} size="sm">
                    {d.label}
                  </Text>
                  {d.isDefault && (
                    <Badge size="xs" color="forest">
                      Default
                    </Badge>
                  )}
                  {!d.verified && (
                    <Badge size="xs" color="gray" variant="light">
                      Not verified
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  {destinationKindLabel[d.kind]} · {d.accountIdentifierMasked}
                  {d.branchOrIfsc ? ` · ${d.branchOrIfsc}` : ''}
                </Text>
              </div>
            </Group>
            <Menu position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${d.label}`}>
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {!d.isDefault && (
                  <Menu.Item leftSection={<IconStar size={14} />} onClick={() => makeDefault.mutate(d.id)}>
                    Use by default
                  </Menu.Item>
                )}
                <Menu.Item
                  color="signal"
                  leftSection={<IconTrash size={14} />}
                  onClick={() =>
                    void confirmAction({ title: 'Remove this payout account?', body: `${d.label} will no longer receive payouts.`, confirmLabel: 'Remove', danger: true }).then(
                      (ok) => ok && remove.mutate(d.id),
                    )
                  }
                >
                  Remove
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Card>
      ))}
      <Group>
        <Button variant="light" leftSection={<IconPlus size={16} />} onClick={onAdd} size="xs">
          Add another account
        </Button>
      </Group>
    </Stack>
  );
}

export default function PayoutsPage() {
  const balance = useQuery({ queryKey: ['payouts', 'balance'], queryFn: payoutsApi.balance });
  const destinations = useQuery({ queryKey: ['payouts', 'destinations'], queryFn: payoutsApi.destinations });
  const [requesting, setRequesting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<string | null>('payouts');

  const b = balance.data;
  const currency = b?.currency ?? 'NPR';
  const available = b?.availableValue ?? 0;
  const dests = destinations.data ?? [];
  const blocked =
    !b ? 'Loading…' : available < PAYOUT_MIN ? `You can request a payout once you have ${formatMoney(PAYOUT_MIN)} available.` : dests.length === 0 ? 'Add a payout account first.' : null;

  return (
    <>
      <PageHeader
        title="Payouts & earnings"
        description="Your money from delivered orders, after StyleMint’s commission."
        actions={
          <Button
            leftSection={<IconCash size={16} />}
            disabled={!!blocked}
            title={blocked ?? undefined}
            onClick={() => setRequesting(true)}
          >
            Request payout
          </Button>
        }
      />
      {balance.error ? (
        <ErrorBlock error={balance.error} onRetry={() => void balance.refetch()} title="Could not load your balance" />
      ) : (
        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md" mb="md">
          <KpiTile label="Available" value={b ? formatMoney({ amount: b.availableValue, currency }) : ''} loading={balance.isPending} hint="Ready to pay out" />
          <KpiTile label="Pending" value={b ? formatMoney({ amount: b.pendingValue, currency }) : ''} loading={balance.isPending} tone="amber" hint="From recent orders, on hold" />
          <KpiTile label="Earned in total" value={b ? formatMoney({ amount: b.lifetimeValue, currency }) : ''} loading={balance.isPending} tone="gray" />
        </SimpleGrid>
      )}
      {blocked && b && (
        <Alert color="gray" variant="light" mb="md">
          {blocked}
        </Alert>
      )}
      <Card>
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List mb="md">
            <Tabs.Tab value="payouts">Payouts</Tabs.Tab>
            <Tabs.Tab value="entries">Earnings history</Tabs.Tab>
            <Tabs.Tab value="accounts">Payout accounts</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="payouts">
            <PayoutsList />
          </Tabs.Panel>
          <Tabs.Panel value="entries">
            <EntriesList />
          </Tabs.Panel>
          <Tabs.Panel value="accounts">
            {destinations.isPending ? (
              <ListSkeleton rows={2} />
            ) : destinations.error ? (
              <ErrorBlock error={destinations.error} onRetry={() => void destinations.refetch()} title="Could not load payout accounts" />
            ) : (
              <DestinationsList destinations={dests} onAdd={() => setAdding(true)} />
            )}
          </Tabs.Panel>
        </Tabs>
      </Card>
      {requesting && b && (
        <RequestPayoutModal opened onClose={() => setRequesting(false)} available={available} currency={currency} destinations={dests} />
      )}
      {adding && <AddDestinationModal opened onClose={() => setAdding(false)} first={dests.length === 0} />}
    </>
  );
}
