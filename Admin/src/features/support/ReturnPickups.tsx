import { useEffect, useRef, useState } from 'react';
import { Alert, Anchor, Badge, Button, Group, Image, Modal, Select, SimpleGrid, Skeleton, Stack, Table, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle } from '@tabler/icons-react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { newIdempotencyKey } from '@/api/client';
import { ApiError, messageOf } from '@/api/errors';
import {
  ACTION_NOT_ALLOWED,
  ACTION_NOT_ALLOWED_TEXT,
  FAILURE_CODE,
  FARE_PAYER,
  isPickupAction,
  label,
  needsAction,
  PICKUP_ACTION_ORDER,
  PICKUP_ACTIONS,
  PICKUP_STAGE,
  PICKUP_STAGE_TONE,
  RESOLVE_NOTE_MAX,
  returnPickupsApi,
  type PickupAction,
  type ReturnPickupDetail,
  type ReturnPickupDto,
  type WireMoney,
} from '@/api/returnPickups';
import { useAuth } from '@/auth/guards';
import { withStepUp } from '@/auth/stepUp';
import { FieldGrid, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { ErrorBlock, NotAvailableBlock, SectionCard } from '@/components/StateBlocks';
import { useCursorPages } from '@/hooks/useCursorPages';
import { useListState } from '@/hooks/useListState';
import { fmtMoney, humanize } from '@/lib/format';

const missing = (e: unknown) => e instanceof ApiError && e.isMissingEndpoint;
const money = (m: WireMoney | null | undefined) => (m ? fmtMoney(m.amount, m.currency) : null);

export function PickupStageBadge({ stage }: { stage: string | null | undefined }) {
  if (!stage) return <Text span c="dimmed">—</Text>;
  return (
    <Badge variant="light" color={PICKUP_STAGE_TONE[stage] ?? 'gray'}>
      {label(PICKUP_STAGE, stage)}
    </Badge>
  );
}

/** NeedsSupport / AttemptFailed / NoRiders: support has to unblock it (return-fixes contract §B). */
export function NeedsActionBadge() {
  return (
    <Badge variant="filled" color="signal" data-testid="needs-action">
      Needs action
    </Badge>
  );
}

const detailKey = (returnRequestId: string) => ['return-pickups', 'detail', returnRequestId] as const;

/**
 * Confirm a support action: says what happens, takes the required note (1–500) the audit row keeps. The same
 * submission retried keeps its Idempotency-Key; another action or a changed note is a new write with a new key.
 */
export function ResolvePickupModal({
  returnRequestId,
  action,
  onClose,
  onMissing,
}: {
  returnRequestId: string;
  action: PickupAction | null;
  onClose: () => void;
  /** The resolve route answered a bare 404: this server does not have it yet. */
  onMissing: () => void;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyFor = useRef<{ body: string; key: string } | null>(null);

  useEffect(() => {
    setNote('');
    setTouched(false);
    setBusy(false);
    setError(null);
    keyFor.current = null;
  }, [action, returnRequestId]);

  const spec = action ? PICKUP_ACTIONS[action] : null;
  const trimmed = note.trim();
  const noteError = !trimmed ? 'Write a note for the audit log' : trimmed.length > RESOLVE_NOTE_MAX ? `Keep the note under ${RESOLVE_NOTE_MAX} characters` : null;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['return-pickups'] });
    void qc.invalidateQueries({ queryKey: ['returns'] });
  };
  const close = () => {
    if (!busy) onClose();
  };

  const submit = async () => {
    if (!action || !spec) return;
    setTouched(true);
    if (noteError) return;
    const body = { action, note: trimmed };
    const bodyKey = JSON.stringify(body);
    if (!keyFor.current || keyFor.current.body !== bodyKey) keyFor.current = { body: bodyKey, key: newIdempotencyKey() };
    const key = keyFor.current.key;
    setBusy(true);
    setError(null);
    try {
      const result = await withStepUp(() => returnPickupsApi.resolve(returnRequestId, body, key));
      if (result) qc.setQueryData(detailKey(returnRequestId), result);
      notifications.show({ color: 'forest', title: 'Done', message: `${spec.label}: recorded.` });
      refresh();
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && caught.isMissingEndpoint) {
        notifications.show({ color: 'amber', title: 'Not available yet', message: 'Support actions for return pickups are not on this server yet.' });
        onMissing();
        onClose();
      } else if (caught instanceof ApiError && caught.code === ACTION_NOT_ALLOWED) {
        setError(ACTION_NOT_ALLOWED_TEXT);
        refresh();
      } else if (caught instanceof ApiError && caught.code === 'mfa.step_up_cancelled') {
        setError('Cancelled - nothing was changed.');
      } else {
        const cid = caught instanceof ApiError && caught.correlationId ? ` (reference ${caught.correlationId})` : '';
        setError(`${messageOf(caught)}${cid}`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={action !== null} onClose={close} title={<Text fw={650}>{spec?.label}</Text>} size="md" closeOnClickOutside={!busy}>
      {spec && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          noValidate
        >
          <Stack gap="md">
            <Text size="sm">{spec.consequence}</Text>
            <Textarea
              label="Note"
              description={`Why - kept in the audit log. Up to ${RESOLVE_NOTE_MAX} characters.`}
              required
              autosize
              minRows={3}
              maxRows={8}
              value={note}
              onChange={(e) => setNote(e.currentTarget.value)}
              error={touched ? noteError : null}
              data-autofocus
            />
            {error && (
              <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
                {error}
              </Alert>
            )}
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={close} disabled={busy}>
                Back
              </Button>
              <Button type="submit" color={spec.danger ? 'signal' : undefined} loading={busy}>
                {spec.label}
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}

/** Set once the resolve route answered a bare 404, so the buttons stay hidden for the rest of this visit. */
let resolveMissing = false;
/** Tests only. */
export function __resetResolveMissingForTests() {
  resolveMissing = false;
}

/** One button per `allowedActions` entry, for SupportAgent / SuperAdmin. Nothing on an older server. */
function PickupActions({ returnRequestId, pickup }: { returnRequestId: string; pickup: ReturnPickupDetail }) {
  const { can } = useAuth();
  const [action, setAction] = useState<PickupAction | null>(null);
  const [missing, setMissing] = useState(resolveMissing);
  const allowed = new Set((pickup.allowedActions ?? []).filter(isPickupAction));
  const actions = PICKUP_ACTION_ORDER.filter((a) => allowed.has(a));
  if (!can('resolveReturnPickups') || missing || actions.length === 0) return null;
  return (
    <>
      <Group gap="xs" data-testid="pickup-actions">
        {actions.map((a) => (
          <Button key={a} size="xs" variant={PICKUP_ACTIONS[a].danger ? 'light' : 'filled'} color={PICKUP_ACTIONS[a].danger ? 'signal' : undefined} onClick={() => setAction(a)}>
            {PICKUP_ACTIONS[a].label}
          </Button>
        ))}
      </Group>
      <ResolvePickupModal
        returnRequestId={returnRequestId}
        action={action}
        onClose={() => setAction(null)}
        onMissing={() => {
          resolveMissing = true;
          setMissing(true);
        }}
      />
    </>
  );
}

function fareText(p: ReturnPickupDto) {
  if (!p.fare) return null;
  const amount = money(p.fare.amount);
  if (amount) return p.fare.isFinal ? amount : `${amount} (not final)`;
  return null;
}

/**
 * The pickup's facts (stage, rider, fare, payer, attempts, photos, hops, proofs), a "Needs action" badge, and the
 * support actions the server allows (return-fixes contract §B).
 */
export function ReturnPickupFacts({ returnRequestId }: { returnRequestId: string }) {
  const q = useQuery({
    queryKey: detailKey(returnRequestId),
    queryFn: ({ signal }) => returnPickupsApi.get(returnRequestId, signal),
    staleTime: 30_000,
  });
  if (q.isLoading) return <Skeleton height={120} radius="md" />;
  if (q.error) {
    if (missing(q.error)) return <NotAvailableBlock what="Return pickup details" />;
    if (q.error instanceof ApiError && q.error.status === 404)
      return (
        <Text size="sm" c="dimmed">
          No rider pickup for this return.
        </Text>
      );
    return <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />;
  }
  const p = q.data;
  if (!p) return null;
  const hops = p.hops ?? [];
  const proofs = p.proofs ?? [];
  return (
    <Stack gap="md" data-testid="admin-return-pickup">
      {needsAction(p) && (
        <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} p="xs">
          <Group gap="xs">
            <NeedsActionBadge />
            <Text size="sm">This pickup is stuck. Check with the seller and the rider, then choose what happens next.</Text>
          </Group>
        </Alert>
      )}
      <PickupActions returnRequestId={returnRequestId} pickup={p} />
      <FieldGrid
        fields={[
          { label: 'Stage', value: <PickupStageBadge stage={p.stage} /> },
          { label: 'Mode', value: p.mode ? humanize(p.mode) : null },
          { label: 'Parcel', value: p.trackingNumber ? <span className="sm-mono">{p.trackingNumber}</span> : null },
          {
            label: 'Rider',
            value: p.rider
              ? `${p.rider.displayName}${p.rider.rating !== null && p.rider.rating !== undefined ? ` · ★ ${p.rider.rating.toFixed(1)}` : ''}${p.rider.vehicle ? ` · ${p.rider.vehicle}` : ''}`
              : null,
          },
          { label: 'Fare payer', value: p.fare?.payer ? label(FARE_PAYER, p.fare.payer) : null },
          { label: 'Fare', value: fareText(p) },
          { label: 'Buyer cap (up to)', value: money(p.fare?.upTo) },
          {
            label: 'Failed attempts',
            value: p.attempts
              ? `${p.attempts.failed} of ${p.attempts.max}${p.attempts.lastFailureCode ? ` · last: ${label(FAILURE_CODE, p.attempts.lastFailureCode)}` : ''}`
              : null,
          },
          { label: 'Requested', value: <When value={p.requestedUtc} /> },
          { label: 'Request expires', value: <When value={p.requestExpiresUtc} /> },
          { label: 'Collected', value: <When value={p.pickedUpUtc} /> },
          { label: 'Received by seller', value: <When value={p.receivedUtc} /> },
        ]}
      />
      {p.collectionPhotoUrls && p.collectionPhotoUrls.length > 0 && (
        <Stack gap={6}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            Collection photos
          </Text>
          <SimpleGrid cols={{ base: 3, sm: 4 }} spacing="xs">
            {p.collectionPhotoUrls.map((u) => (
              <Anchor key={u} href={u} target="_blank" rel="noopener noreferrer">
                <Image src={u} alt="Collection photo" h={72} radius="sm" fit="cover" />
              </Anchor>
            ))}
          </SimpleGrid>
        </Stack>
      )}
      {hops.length > 0 && (
        <Table withTableBorder striped fz="sm" aria-label="Hops">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Hop</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Rider</Table.Th>
              <Table.Th>Last change</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {hops.map((h, i) => (
              <Table.Tr key={h.id ?? h.hopId ?? i}>
                <Table.Td>{i + 1}</Table.Td>
                <Table.Td>
                  {humanize(h.status ?? h.state ?? null)}
                  {h.failureCode ? ` · ${label(FAILURE_CODE, h.failureCode)}` : ''}
                </Table.Td>
                <Table.Td>{h.courierDisplayName ?? '—'}</Table.Td>
                <Table.Td>
                  <When value={h.completedUtc ?? h.failedUtc ?? h.pickedUpUtc ?? h.acceptedUtc ?? h.createdUtc ?? null} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      {proofs.length > 0 && (
        <Table withTableBorder striped fz="sm" aria-label="Proofs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Proof</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th>Confirmed</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {proofs.map((pr, i) => (
              <Table.Tr key={pr.id ?? i}>
                <Table.Td>{pr.purpose === 'ReturnPickup' ? 'Buyer hand-over' : pr.purpose === 'Delivery' ? 'Seller receipt' : humanize(pr.purpose ?? null)}</Table.Td>
                <Table.Td>{humanize(pr.status ?? null)}</Table.Td>
                <Table.Td>
                  <When value={pr.createdUtc ?? null} />
                </Table.Td>
                <Table.Td>
                  <When value={pr.confirmedUtc ?? null} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

/** Every return pickup, filterable by stage (cursor list). Stuck ones carry "Needs action"; the drawer has the actions. */
export function ReturnPickupsList() {
  const list = useListState(['view', 'stage'] as const, { pageSize: 25 });
  const cursors = useCursorPages(`${list.filters.stage}|${list.pageSize}`, list.page, list.setPage);
  const query = useQuery({
    queryKey: ['return-pickups', list.filters.stage, cursors.cursor, list.page, list.pageSize],
    queryFn: ({ signal }) => returnPickupsApi.list({ stage: list.filters.stage, cursor: cursors.cursor, page: list.page, pageSize: list.pageSize }, signal),
    enabled: cursors.ready,
    placeholderData: keepPreviousData,
    retry: false,
  });
  useEffect(() => {
    if (query.data) cursors.remember(list.page, query.data.nextCursor);
  }, [query.data, list.page, cursors]);

  if (missing(query.error)) return <NotAvailableBlock what="Return pickups" />;

  const columns: Column<ReturnPickupDto>[] = [
    {
      key: 'parcel',
      header: 'Parcel',
      render: (p) => <TwoLine primary={<span className="sm-mono">{p.trackingNumber ?? '—'}</span>} secondary={p.mode ? humanize(p.mode) : undefined} />,
    },
    {
      key: 'stage',
      header: 'Stage',
      render: (p) => (
        <Group gap={6} wrap="wrap">
          <PickupStageBadge stage={p.stage} />
          {needsAction(p) && <NeedsActionBadge />}
        </Group>
      ),
    },
    { key: 'rider', header: 'Rider', visibleFrom: 'sm', render: (p) => p.rider?.displayName ?? '—' },
    { key: 'payer', header: 'Fare payer', visibleFrom: 'md', render: (p) => (p.fare?.payer ? label(FARE_PAYER, p.fare.payer) : '—') },
    { key: 'fare', header: 'Fare', visibleFrom: 'md', render: (p) => fareText(p) ?? (money(p.fare?.upTo) ? `up to ${money(p.fare?.upTo)}` : '—') },
    { key: 'attempts', header: 'Failed', visibleFrom: 'lg', render: (p) => (p.attempts ? `${p.attempts.failed}/${p.attempts.max}` : '—') },
    { key: 'requested', header: 'Requested', visibleFrom: 'sm', render: (p) => <When value={p.requestedUtc} relative /> },
  ];
  const selected = query.data?.items.find((p) => p.returnRequestId === list.selected) ?? null;

  return (
    <>
      <DataTable
        label="Return pickups"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading || !cursors.ready}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(p) => p.returnRequestId}
        onRowClick={(p) => list.open(p.returnRequestId)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        pagerMode="cursor"
        filtered={!!list.filters.stage}
        emptyTitle="No return pickups"
        emptyBody="Rider pickups appear here once a seller approves a return."
        toolbar={
          <Select
            label="Stage"
            w={220}
            clearable
            placeholder="Any"
            data={Object.entries(PICKUP_STAGE).map(([value, l]) => ({ value, label: l }))}
            value={list.filters.stage || null}
            onChange={(v) => list.setFilter('stage', v)}
          />
        }
      />
      <DetailDrawer
        opened={!!list.selected}
        onClose={() => list.open(null)}
        title={selected?.trackingNumber ?? 'Return pickup'}
        badges={
          selected && (
            <>
              <PickupStageBadge stage={selected.stage} />
              {needsAction(selected) && <NeedsActionBadge />}
            </>
          )
        }
      >
        {list.selected && (
          <SectionCard title="Return pickup" description="Codes are never shown.">
            <ReturnPickupFacts returnRequestId={list.selected} />
          </SectionCard>
        )}
      </DetailDrawer>
    </>
  );
}
