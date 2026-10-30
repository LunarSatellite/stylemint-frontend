import { useState, type ReactNode } from 'react';
import { Alert, Avatar, Badge, Button, Card, Group, Image, Loader, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Timeline } from '@mantine/core';
import { IconAlertTriangle, IconMotorbike, IconRefresh, IconStar } from '@tabler/icons-react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDateTime, formatMoney, fromNow, humanize, initialsOf } from '../../lib/format';
import { confirmAction, toastSuccess } from '../../lib/notify';
import { Countdown, RiderRow } from '../orders/DeliveryPartner';
import {
  NO_PRO_RIDER_HIGH_VALUE,
  NO_VERIFIED_RIDER_HIGH_VALUE,
  offersVerifiedRider,
  VERIFIED_RIDER_NOTE,
  type DeliveryRequest,
  type InterestedRider,
} from '../orders/api';
import { ReturnState, type ReturnItem } from './api';
import {
  CONFIRM_STAGES,
  failureLabel,
  isReceiptPending,
  labelOfReason,
  labelOfStage,
  pickupErrorMessage,
  pickupKey,
  returnPickupApi,
  SEARCH_STAGES,
  stageColor,
  type PickupRead,
  type ReturnPickup,
} from './returnPickup';

/** Stages where the pickup is still moving: re-read every 15 s so the gate and the timeline follow. */
const MOVING = new Set(['SearchingRider', 'RidersInterested', 'RiderAssigned', 'AwaitingBuyerConfirmation', 'Collected', 'AwaitingSellerConfirmation']);

function pickupQuery(item: ReturnItem) {
  return {
    queryKey: pickupKey(item.id),
    // The list item carries `pickupStage` (even null) once the backend has the feature.
    queryFn: () => returnPickupApi.pickup(item.id, 'pickupStage' in item),
    refetchInterval: (q: { state: { data?: PickupRead } }) => {
      const d = q.state.data;
      return d?.status === 'ok' && d.pickup.mode === 'Rider' && MOVING.has(d.pickup.stage ?? '') ? 15_000 : (false as const);
    },
  };
}

/**
 * The pickup read for every approved return on the page, so the list can gate "Item received" without a hook per card.
 * Shares the cache with each card's panel (same query key).
 */
export function useReturnPickups(items: ReturnItem[]) {
  const approved = items.filter((r) => r.state === ReturnState.Approved);
  const reads = useQueries({ queries: approved.map((r) => pickupQuery(r)) });
  const byId = new Map<string, PickupRead | undefined>();
  approved.forEach((r, i) => byId.set(r.id, reads[i]?.data));
  return {
    /** A rider-mode return the seller has not confirmed receiving yet: "Item received" would answer 409. */
    receiptPending: (r: ReturnItem) => r.state === ReturnState.Approved && isReceiptPending(byId.get(r.id)),
  };
}

function money(m: { amount: number; currency: string } | null | undefined) {
  return m ? formatMoney(m) : null;
}

/** Who pays the pickup fee and how much (contract §1, §6). */
function FareLine({ item, pickup }: { item: ReturnItem; pickup: ReturnPickup | null }) {
  const payer = pickup?.fare?.payer ?? item.pickupFarePayer ?? null;
  if (!payer && !pickup?.fare) return null;
  const amount = money(pickup?.fare?.amount);
  const upTo = money(pickup?.fare?.upTo);
  const fee = amount ? (pickup?.fare?.isFinal ? amount : `about ${amount}`) : upTo ? `up to ${upTo}` : null;
  let text: string;
  if (payer === 'Seller') text = `You pay the pickup fee${fee ? ` (${fee})` : ''}. It is taken from your earnings.`;
  else if (payer === 'Buyer')
    text = `The buyer pays the pickup fee${fee ? ` (${fee}${amount && upTo && !pickup?.fare?.isFinal ? `, up to ${upTo}` : ''})` : ''}. It comes off their refund.`;
  else text = `Pickup fee${fee ? `: ${fee}` : ''}${payer ? ` · paid by ${humanize(payer).toLowerCase()}` : ''}.`;
  return (
    <Text size="xs" data-testid="pickup-fare">
      {text}
      {payer === 'Seller' && item.reasonCategory === 'Unspecified' && ' The buyer’s app did not ask for a reason type.'}
    </Text>
  );
}

/** Reason category + fee + refund maths, for any return that carries them. */
function ReturnSummary({ item, pickup }: { item: ReturnItem; pickup: ReturnPickup | null }) {
  const reason = labelOfReason(item.reasonCategory);
  const b = item.refundBreakdown;
  if (!reason && !item.pickupFarePayer && !pickup?.fare && !b) return null;
  return (
    <Stack gap={4}>
      {reason && (
        <Group gap={6}>
          <Text size="xs" c="dimmed">
            Reason type
          </Text>
          <Badge size="sm" variant="light" color={item.reasonCategory === 'ChangedMind' ? 'gray' : 'amber'} data-testid="reason-category">
            {reason}
          </Badge>
        </Group>
      )}
      <FareLine item={item} pickup={pickup} />
      {b && (
        <Text size="xs" c="dimmed" data-testid="refund-breakdown">
          Item {formatMoney(b.itemTotal)} − pickup {formatMoney(b.pickupFareDeducted)} = refund {formatMoney(b.refundAmount)}
        </Text>
      )}
    </Stack>
  );
}

function stepOf(p: ReturnPickup): number {
  const s = p.stage ?? '';
  if (s === 'ReceivedBySeller' || p.receivedUtc) return 3;
  if (CONFIRM_STAGES.has(s) || p.pickedUpUtc) return 2;
  if (s === 'RiderAssigned' || s === 'AwaitingBuyerConfirmation') return 1;
  return 0;
}

function PickupTimeline({ pickup }: { pickup: ReturnPickup }) {
  const step = stepOf(pickup);
  const items = [
    { title: 'Riders asked', when: pickup.requestedUtc },
    { title: pickup.rider ? `Rider chosen · ${pickup.rider.displayName}` : 'Rider chosen', when: null },
    { title: 'Collected from the buyer', when: pickup.pickedUpUtc },
    { title: 'With you', when: pickup.receivedUtc },
  ];
  return (
    <Timeline active={step} bulletSize={14} lineWidth={2} data-testid="pickup-timeline">
      {items.map((t) => (
        <Timeline.Item key={t.title} title={<Text size="xs" fw={600}>{t.title}</Text>}>
          {t.when && (
            <Text size="xs" c="dimmed">
              {formatDateTime(t.when)}
            </Text>
          )}
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

function RiderCard({ rider, note }: { rider: NonNullable<ReturnPickup['rider']>; note: string }) {
  return (
    <Group wrap="nowrap" gap="sm">
      <Avatar src={rider.avatarUrl ?? undefined} radius="xl" color="forest">
        {initialsOf(rider.displayName)}
      </Avatar>
      <div>
        <Text fw={650} size="sm">
          {rider.displayName}
        </Text>
        <Group gap="sm">
          {rider.rating !== null && rider.rating !== undefined && (
            <Text size="xs" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <IconStar size={12} fill="#ffbe18" color="#e3a600" aria-hidden /> {rider.rating.toFixed(1)}
            </Text>
          )}
          {rider.vehicle && (
            <Text size="xs" c="dimmed" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <IconMotorbike size={12} /> {rider.vehicle}
            </Text>
          )}
        </Group>
        <Text size="xs" c="dimmed">
          {note}
        </Text>
      </div>
    </Group>
  );
}

/** Search, watch and choose a rider for a return: the forward rider picker, keyed by the return. */
function ReturnRiderPicker({ returnId, pickup, legacy }: { returnId: string; pickup: ReturnPickup | null; legacy: boolean }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const key = ['care', 'returns', 'pickup-request', returnId];
  const current = useQuery({
    queryKey: key,
    queryFn: () => returnPickupApi.currentRequest(returnId),
    enabled: !legacy,
    refetchInterval: (q) => {
      const s = (q.state.data as DeliveryRequest | null | undefined)?.state;
      return s === 'Searching' || s === 'RidersInterested' ? 5000 : false;
    },
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: pickupKey(returnId) });

  const open = useMutation({
    mutationFn: (vars: { allowVerifiedNonPro?: boolean } | void) =>
      returnPickupApi.openRequest(returnId, vars ? { allowVerifiedNonPro: vars.allowVerifiedNonPro } : undefined),
    onSuccess: (data, vars) => {
      setError(null);
      qc.setQueryData(key, data);
      refresh();
      // A high-value return found no Pro rider: ask straight away whether a verified rider may collect it.
      if (!(vars && vars.allowVerifiedNonPro) && offersVerifiedRider(data)) void askVerifiedRider();
    },
    onError: (e) => setError(pickupErrorMessage(e)),
  });

  /** Routing is never widened without this explicit yes; the backend records who agreed and when. */
  const askVerifiedRider = async () => {
    const ok = await confirmAction({
      title: 'Use a verified rider instead?',
      body: VERIFIED_RIDER_NOTE,
      confirmLabel: 'Use a verified rider',
      cancelLabel: 'Not now',
    });
    if (ok) open.mutate({ allowVerifiedNonPro: true });
  };
  const select = useMutation({
    mutationFn: (offerId: string) => returnPickupApi.selectRider(returnId, offerId),
    onSuccess: (data) => {
      setError(null);
      qc.setQueryData(key, data);
      toastSuccess('Rider chosen. They are on their way to the buyer.');
      refresh();
    },
    onError: (e) => {
      setError(pickupErrorMessage(e));
      void current.refetch();
    },
  });
  const choose = async (r: InterestedRider) => {
    const ok = await confirmAction({
      title: `Choose ${r.displayName}?`,
      body: 'The rider is told to collect this return from the buyer. Other riders are released.',
      confirmLabel: 'Choose rider',
    });
    if (ok) select.mutate(r.offerId);
  };

  const errorBox = error && (
    <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert" p="xs">
      {error}
    </Alert>
  );

  if (legacy) {
    return (
      <Stack gap="xs">
        {errorBox}
        <Text size="sm">Ask a StyleMint rider to collect this item from the buyer and bring it to you.</Text>
        <Group>
          <Button size="xs" loading={open.isPending} onClick={() => open.mutate()} leftSection={<IconMotorbike size={14} />}>
            Find a rider
          </Button>
        </Group>
      </Stack>
    );
  }

  const req = current.data;
  const stage = pickup?.stage ?? '';
  const tryAgain = (
    <Group>
      <Button size="xs" loading={open.isPending} onClick={() => open.mutate()} leftSection={<IconRefresh size={14} />}>
        Try again
      </Button>
    </Group>
  );

  let body: ReactNode;
  if (current.isPending) {
    body = (
      <Group gap="xs">
        <Loader size="xs" />
        <Text size="sm">Checking riders…</Text>
      </Group>
    );
  } else if (current.error) {
    body = (
      <Group gap="xs">
        <Text size="sm" c="signal">
          Could not check riders.
        </Text>
        <Button size="xs" variant="subtle" onClick={() => void current.refetch()}>
          Retry
        </Button>
      </Group>
    );
  } else if (req && (req.state === 'Searching' || req.state === 'RidersInterested')) {
    body = (
      <Stack gap="xs">
        <Group justify="space-between" gap="xs">
          <Group gap="xs">
            <ThemeIcon variant="light" radius="xl" size="sm">
              <Loader size={10} />
            </ThemeIcon>
            <Text size="sm" fw={600}>
              {req.interested.length === 0 ? `Riders notified (${req.notifiedCount})` : `${req.interested.length} interested`}
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            {req.notifiedCount} notified within {req.radiusKm} km · <Countdown until={req.expiresUtc} />
          </Text>
        </Group>
        {req.verifiedRiderConsent && (
          <Text size="xs" c="dimmed" data-testid="verified-rider-consent">
            High-value return: you agreed to a verified rider {fromNow(req.verifiedRiderConsent.consentedUtc)}.
          </Text>
        )}
        {req.interested.length === 0 ? (
          <Text size="xs" c="dimmed">
            Riders who can collect it appear here. This updates by itself — opened {fromNow(req.openedUtc)}.
          </Text>
        ) : (
          req.interested.map((r) => (
            <RiderRow key={r.offerId} rider={r} onChoose={() => void choose(r)} choosing={select.isPending && select.variables === r.offerId} />
          ))
        )}
      </Stack>
    );
  } else if (req?.state === 'NoRiders' && req.noRidersReason === NO_PRO_RIDER_HIGH_VALUE) {
    body = (
      <Stack gap="xs">
        <Alert color="amber" variant="light" p="xs" title="No Pro rider is available for this high-value return" data-testid="no-pro-rider">
          <Stack gap="xs">
            <Text size="sm">
              High-value parcels go to Pro riders only.
              {req.canUseVerifiedRider ? ' You can let a verified rider collect it instead, or try again later.' : ' Try again later.'}
            </Text>
            {req.canUseVerifiedRider && (
              <Group>
                <Button size="xs" variant="light" loading={open.isPending} onClick={() => void askVerifiedRider()}>
                  Use a verified rider
                </Button>
              </Group>
            )}
          </Stack>
        </Alert>
        {tryAgain}
      </Stack>
    );
  } else if (req?.state === 'NoRiders' && req.noRidersReason === NO_VERIFIED_RIDER_HIGH_VALUE) {
    body = (
      <Stack gap="xs">
        <Alert color="amber" variant="light" p="xs" data-testid="no-verified-rider">
          You agreed to a verified rider for this high-value return, but none is nearby right now. Try again in a few minutes.
        </Alert>
        {tryAgain}
      </Stack>
    );
  } else if (stage === 'AttemptFailed') {
    const a = pickup?.attempts;
    const why = a?.lastFailureCode ? (failureLabel[a.lastFailureCode] ?? humanize(a.lastFailureCode).toLowerCase()) : null;
    body = (
      <Stack gap="xs">
        <Alert color="amber" variant="light" p="xs">
          The rider couldn’t collect the item{why ? ` (${why})` : ''}.{a ? ` Attempt ${a.failed} of ${a.max}.` : ''}
        </Alert>
        {tryAgain}
      </Stack>
    );
  } else if (!req || req.state === 'NoRiders' || req.state === 'Expired' || stage === 'NoRiders') {
    body = (
      <Stack gap="xs">
        <Alert color="amber" variant="light" p="xs">
          {req?.state === 'Expired' ? 'Nobody was chosen in time.' : 'No rider yet.'} Try again to ask riders nearby.
        </Alert>
        {tryAgain}
      </Stack>
    );
  } else if (req.state === 'Assigned') {
    body = (
      <Text size="sm">
        Rider chosen{req.assigned ? `: ${req.assigned.displayName}` : ''}. Updating…
      </Text>
    );
  } else {
    // A request state this app doesn't know yet.
    body = (
      <Stack gap="xs">
        <Text size="sm">Rider search: {humanize(req.state)}</Text>
        {tryAgain}
      </Stack>
    );
  }

  return (
    <Stack gap="xs">
      {errorBox}
      {body}
    </Stack>
  );
}

/** The seller is the recipient of the return parcel: type the rider's code to confirm receipt. */
function ConfirmByCode({ returnId, trackingNumber }: { returnId: string; trackingNumber: string | null }) {
  const qc = useQueryClient();
  const [packageNumber, setPackageNumber] = useState(trackingNumber ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const confirm = useMutation({
    mutationFn: () => returnPickupApi.confirmReceipt(packageNumber.trim(), code.trim()),
    onSuccess: () => {
      setError(null);
      toastSuccess('Return received. Check the item, then mark it received.');
      void qc.invalidateQueries({ queryKey: pickupKey(returnId) });
      void qc.invalidateQueries({ queryKey: ['care', 'returns'] });
    },
    onError: (e) => setError(pickupErrorMessage(e)),
  });
  const valid = packageNumber.trim().length > 0 && /^\d{6}$/.test(code.trim());
  return (
    <Stack gap="xs" data-testid="confirm-by-code">
      {error && (
        <Alert color="signal" variant="light" p="xs" role="alert">
          {error}
        </Alert>
      )}
      <Group gap="xs" align="flex-end" wrap="wrap">
        <TextInput size="xs" label="Parcel number" value={packageNumber} onChange={(e) => setPackageNumber(e.currentTarget.value)} w={170} />
        <TextInput
          size="xs"
          label="Rider’s code"
          placeholder="6 digits"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.currentTarget.value.replace(/\D/g, ''))}
          w={110}
        />
        <Button size="xs" disabled={!valid} loading={confirm.isPending} onClick={() => confirm.mutate()}>
          Confirm receipt
        </Button>
      </Group>
    </Stack>
  );
}

function StageBody({ item, pickup }: { item: ReturnItem; pickup: ReturnPickup }) {
  const stage = pickup.stage ?? '';
  if (SEARCH_STAGES.has(stage)) return <ReturnRiderPicker returnId={item.id} pickup={pickup} legacy={false} />;
  const rider = pickup.rider;
  if (stage === 'RiderAssigned' || stage === 'AwaitingBuyerConfirmation')
    return rider ? (
      <RiderCard rider={rider} note={stage === 'RiderAssigned' ? 'On the way to the buyer.' : 'At the buyer now.'} />
    ) : (
      <Text size="sm">A rider is on the way to the buyer.</Text>
    );
  if (CONFIRM_STAGES.has(stage))
    return (
      <Stack gap="xs">
        {rider && <RiderCard rider={rider} note={stage === 'Collected' ? 'Bringing the item to you.' : 'With you now. Enter the code from their app.'} />}
        <ConfirmByCode returnId={item.id} trackingNumber={pickup.trackingNumber} />
      </Stack>
    );
  if (stage === 'ReceivedBySeller') return <Text size="sm">You have the item. Check it, then mark it received.</Text>;
  if (stage === 'Cancelled')
    return (
      <Alert color="gray" variant="light" p="xs">
        The pickup was cancelled.
      </Alert>
    );
  if (stage === 'NeedsSupport')
    return (
      <Alert color="signal" variant="light" p="xs">
        StyleMint support is looking into this pickup.
      </Alert>
    );
  return <Text size="sm">Pickup: {labelOfStage(stage || null)}</Text>;
}

/**
 * "Return pickup" on a return card (contract §3, §9): reason type and who pays, then for an approved return the rider
 * search / chosen rider / confirm-by-code, the stage timeline, and a disabled "Item received" while receipt is pending.
 */
export function ReturnPickupPanel({ item }: { item: ReturnItem }) {
  const approved = item.state === ReturnState.Approved;
  const q = useQuery({ ...pickupQuery(item), enabled: approved });
  const read = q.data;
  const pickup = read?.status === 'ok' ? read.pickup : null;
  const summary = <ReturnSummary item={item} pickup={pickup} />;
  if (!approved) return summary;

  let section: ReactNode = null;
  if (q.isPending) {
    section = (
      <Group gap="xs">
        <Loader size="xs" />
        <Text size="xs" c="dimmed">
          Checking the return pickup…
        </Text>
      </Group>
    );
  } else if (q.error) {
    section = (
      <Group gap="xs">
        <Text size="xs" c="signal">
          Could not load the return pickup.
        </Text>
        <Button size="compact-xs" variant="subtle" onClick={() => void q.refetch()}>
          Retry
        </Button>
      </Group>
    );
  } else if (read && read.status !== 'unavailable') {
    const legacy = read.status === 'none' || read.pickup.mode === 'Legacy';
    const pending = isReceiptPending(read);
    section = (
      <Card withBorder padding="sm" data-testid="return-pickup">
        <Stack gap="xs">
          <Group justify="space-between" gap="xs">
            <Text fw={650} size="sm">
              Return pickup
            </Text>
            {pickup && !legacy && (
              <Badge size="sm" variant="light" color={stageColor[pickup.stage ?? ''] ?? 'gray'} data-testid="pickup-stage">
                {labelOfStage(pickup.stage)}
              </Badge>
            )}
          </Group>
          {legacy || !pickup ? (
            <ReturnRiderPicker returnId={item.id} pickup={pickup} legacy />
          ) : (
            <>
              <StageBody item={item} pickup={pickup} />
              <PickupTimeline pickup={pickup} />
              {pickup.collectionPhotoUrls && pickup.collectionPhotoUrls.length > 0 && (
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    Photos the rider took at collection
                  </Text>
                  <SimpleGrid cols={{ base: 3, sm: 4 }} spacing="xs">
                    {pickup.collectionPhotoUrls.map((u) => (
                      <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                        <Image src={u} alt="Collection photo" h={64} radius="sm" fit="cover" />
                      </a>
                    ))}
                  </SimpleGrid>
                </Stack>
              )}
            </>
          )}
          {pending && (
            <Stack gap={4}>
              <Group>
                <Button size="xs" disabled>
                  Item received
                </Button>
              </Group>
              <Text size="xs" c="dimmed" data-testid="mark-received-hint">
                You can mark it received after you confirm the rider’s code.
              </Text>
            </Stack>
          )}
        </Stack>
      </Card>
    );
  }
  return (
    <Stack gap="xs">
      {summary}
      {section}
    </Stack>
  );
}
