import { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Loader,
  Modal,
  Progress,
  Rating,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { IconAlertTriangle, IconCircleCheckFilled, IconMapPin, IconMotorbike, IconRefresh, IconStar, IconUserCheck } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, messageOf } from '../../api/client';
import { ErrorBlock } from '../../components/StateBlocks';
import { formatDate, formatMoney, fromNow, initialsOf } from '../../lib/format';
import { confirmAction, toastSuccess } from '../../lib/notify';
import { SealForm } from './SealForm';
import {
  NO_PRO_RIDER_HIGH_VALUE,
  NO_VERIFIED_RIDER_HIGH_VALUE,
  offersVerifiedRider,
  ordersApi,
  tagLabel,
  VERIFIED_RIDER_NOTE,
  type DeliveryRequest,
  type InterestedRider,
  type SubOrderDetail,
} from './api';

const tierLabel: Record<string, string> = { Neighbor: 'Neighbour rider', Traveler: 'Traveller rider', Pro: 'Pro rider' };

const isNotSealed = (e: unknown) => e instanceof ApiError && e.code === 'delivery_request.parcel_not_sealed';

function deliveryErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'delivery_request.parcel_not_sealed':
        return 'This parcel has no seal yet. Seal it below, then choose your rider.';
      case 'delivery_request.expired':
        return 'This request expired. Search again to notify riders.';
      case 'delivery_request.rider_not_interested':
        return 'That rider is no longer available. Choose another rider.';
      case 'delivery_request.already_assigned':
        return 'A rider is already assigned to this parcel.';
      case 'delivery_request.closed':
        return 'This parcel is no longer waiting for a rider.';
    }
  }
  return messageOf(e);
}

function RatingLine({ rating, count }: { rating: number | null; count?: number }) {
  if (rating === null || rating === undefined) {
    return (
      <Badge size="sm" variant="light" color="blue">
        New rider
      </Badge>
    );
  }
  return (
    <Group gap={4} wrap="nowrap">
      <IconStar size={14} fill="#ffbe18" color="#e3a600" aria-hidden />
      <Text size="sm" fw={600}>
        {rating.toFixed(1)}
      </Text>
      {count !== undefined && (
        <Text size="xs" c="dimmed">
          ({count})
        </Text>
      )}
    </Group>
  );
}

/** One interested rider. `onDetails` is optional: return pickups have no rider-profile route, so the card is not a button there. */
export function RiderRow({
  rider,
  onDetails,
  onChoose,
  choosing,
}: {
  rider: InterestedRider;
  onDetails?: () => void;
  onChoose: () => void;
  choosing: boolean;
}) {
  const body = (
    <Group wrap="nowrap" align="flex-start" gap="sm">
      <Avatar src={rider.avatarUrl ?? undefined} radius="xl" color="forest">
        {initialsOf(rider.displayName)}
      </Avatar>
      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
        <Group gap={6} wrap="nowrap">
          <Text fw={650} size="sm" truncate>
            {rider.displayName}
          </Text>
          {rider.verified && <IconCircleCheckFilled size={16} color="var(--mantine-color-forest-6)" aria-label="Verified rider" />}
        </Group>
        <Group gap="sm" wrap="wrap">
          <RatingLine rating={rider.rating} count={rider.ratingCount} />
          <Text size="xs" c="dimmed">
            {rider.completedDeliveries} deliveries
          </Text>
        </Group>
        <Group gap="sm" wrap="wrap">
          <Text size="xs" c="dimmed" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <IconMapPin size={12} /> {rider.distanceKm.toFixed(1)} km away
          </Text>
          {rider.vehicle && (
            <Text size="xs" c="dimmed" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <IconMotorbike size={12} /> {rider.vehicle}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            {tierLabel[rider.tier] ?? rider.tier}
          </Text>
          {rider.fare && (
            <Text size="xs" fw={600}>
              Fare {formatMoney(rider.fare)}
            </Text>
          )}
        </Group>
      </Stack>
    </Group>
  );
  return (
    <Card padding="sm" withBorder>
      {onDetails ? (
        <UnstyledButton onClick={onDetails} style={{ width: '100%' }} aria-label={`See details for ${rider.displayName}`}>
          {body}
        </UnstyledButton>
      ) : (
        body
      )}
      <Group justify="flex-end" gap="xs" mt="xs">
        {onDetails && (
          <Button size="xs" variant="subtle" onClick={onDetails}>
            Details
          </Button>
        )}
        <Button size="xs" onClick={onChoose} loading={choosing}>
          Choose
        </Button>
      </Group>
    </Card>
  );
}

function RiderDetailsModal({
  orderId,
  rider,
  onClose,
  onChoose,
  choosing,
}: {
  orderId: string;
  rider: InterestedRider | null;
  onClose: () => void;
  onChoose: (r: InterestedRider) => void;
  choosing: boolean;
}) {
  const profile = useQuery({
    queryKey: ['delivery', 'rider', orderId, rider?.courierId],
    queryFn: () => ordersApi.riderProfile(orderId, rider!.courierId),
    enabled: !!rider,
    retry: false,
  });
  if (!rider) return null;
  // Route not deployed / not available → fall back to the list row's fields.
  const p = profile.data;
  const breakdown = p?.rating?.breakdown ?? {};
  const total = p?.rating?.count ?? 0;
  return (
    <Modal opened={!!rider} onClose={onClose} title="Delivery partner" size="md">
      <Stack gap="md">
        <Group wrap="nowrap">
          <Avatar src={(p?.avatarUrl ?? rider.avatarUrl) || undefined} size={56} radius="xl" color="forest">
            {initialsOf(rider.displayName)}
          </Avatar>
          <div>
            <Group gap={6}>
              <Text fw={700} size="lg">
                {p?.displayName ?? rider.displayName}
              </Text>
              {(p?.verified ?? rider.verified) && (
                <Badge color="forest" variant="light" leftSection={<IconUserCheck size={12} />}>
                  Verified
                </Badge>
              )}
            </Group>
            <Text size="sm" c="dimmed">
              {tierLabel[p?.tier ?? rider.tier] ?? rider.tier}
              {p?.memberSinceUtc ? ` · on StyleMint since ${formatDate(p.memberSinceUtc)}` : ''}
            </Text>
          </div>
        </Group>
        {profile.isPending && (
          <Group gap="xs">
            <Loader size="xs" />
            <Text size="sm" c="dimmed">
              Loading rider details…
            </Text>
          </Group>
        )}
        <SimpleGrid cols={3} spacing="sm">
          <Card padding="sm">
            <Text size="xs" c="dimmed">
              Rating
            </Text>
            <RatingLine rating={p?.rating?.average ?? rider.rating} count={p?.rating?.count ?? rider.ratingCount} />
          </Card>
          <Card padding="sm">
            <Text size="xs" c="dimmed">
              Deliveries
            </Text>
            <Text fw={650}>{p?.completedDeliveries ?? rider.completedDeliveries}</Text>
          </Card>
          <Card padding="sm">
            <Text size="xs" c="dimmed">
              Distance
            </Text>
            <Text fw={650}>{(p?.distanceKm ?? rider.distanceKm).toFixed(1)} km</Text>
          </Card>
        </SimpleGrid>
        {p && (p.onTimeRate !== null || p.cancellationRate !== null || p.vehicle?.type) && (
          <Group gap="lg" wrap="wrap">
            {p.onTimeRate !== null && <Text size="sm">On time: {Math.round(p.onTimeRate * 100)}%</Text>}
            {p.cancellationRate !== null && <Text size="sm">Cancelled: {Math.round(p.cancellationRate * 100)}%</Text>}
            {p.vehicle?.type && (
              <Text size="sm">
                Vehicle: {p.vehicle.type}
                {p.vehicle.plateLast4 ? ` (…${p.vehicle.plateLast4})` : ''}
              </Text>
            )}
          </Group>
        )}
        {total > 0 && (
          <Stack gap={4}>
            {['5', '4', '3', '2', '1'].map((s) => (
              <Group key={s} gap="xs" wrap="nowrap">
                <Text size="xs" w={14}>
                  {s}
                </Text>
                <Progress value={((breakdown[s] ?? 0) / total) * 100} style={{ flex: 1 }} color="amber" size="sm" aria-label={`${s} stars`} />
                <Text size="xs" c="dimmed" w={24} ta="right">
                  {breakdown[s] ?? 0}
                </Text>
              </Group>
            ))}
          </Stack>
        )}
        {p?.rating?.topTags && p.rating.topTags.length > 0 && (
          <Group gap={6}>
            {p.rating.topTags.map((t) => (
              <Badge key={t.tag} variant="light" color="gray">
                {tagLabel[t.tag] ?? t.tag} · {t.count}
              </Badge>
            ))}
          </Group>
        )}
        {p?.recentReviews && p.recentReviews.length > 0 && (
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Recent reviews
            </Text>
            {p.recentReviews.slice(0, 5).map((r, i) => (
              <Card key={i} padding="xs">
                <Group justify="space-between">
                  <Rating value={r.stars} readOnly size="xs" />
                  <Text size="xs" c="dimmed">
                    {r.ageDays === 0 ? 'today' : `${r.ageDays} d ago`}
                  </Text>
                </Group>
                {r.comment && <Text size="sm">{r.comment}</Text>}
              </Card>
            ))}
          </Stack>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Back
          </Button>
          <Button onClick={() => onChoose(rider)} loading={choosing} disabled={p?.state === 'Withdrawn'}>
            Choose this rider
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Date.parse(until) - now;
  if (!Number.isFinite(ms) || ms <= 0) return <>expired</>;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return (
    <>
      {m}:{String(s).padStart(2, '0')} left
    </>
  );
}

/**
 * "Find a delivery partner": open a request (riders within ~5 km are notified), watch who steps
 * forward (polled every 5 s while open), look at a rider's details, choose one, then hand over.
 */
export function DeliveryPartnerDrawer({ order, opened, onClose }: { order: SubOrderDetail; opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [details, setDetails] = useState<InterestedRider | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The seal step: shown on demand, or automatically when choosing a rider was refused for a missing seal. */
  const [sealing, setSealing] = useState(false);
  const [sealed, setSealed] = useState(false);
  /** The rider the seller tried to choose before sealing; chosen automatically once the seal is on. */
  const [pendingOffer, setPendingOffer] = useState<string | null>(null);
  const key = ['delivery', 'request', order.id];

  const current = useQuery({
    queryKey: key,
    queryFn: () => ordersApi.currentDeliveryRequest(order.id),
    enabled: opened,
    refetchInterval: (q) => {
      const s = (q.state.data as DeliveryRequest | null | undefined)?.state;
      return opened && (s === 'Searching' || s === 'RidersInterested') ? 5000 : false;
    },
  });

  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: ['orders'] });
    void qc.invalidateQueries({ queryKey: ['order', order.id] });
    void qc.invalidateQueries({ queryKey: ['delivery'] });
  };

  const open = useMutation({
    mutationFn: (vars: { allowVerifiedNonPro?: boolean } | void) =>
      ordersApi.openDeliveryRequest(order.id, vars ? { allowVerifiedNonPro: vars.allowVerifiedNonPro } : undefined),
    onSuccess: (data, vars) => {
      setError(null);
      qc.setQueryData(key, data);
      // A high-value parcel found no Pro rider: ask straight away whether a verified rider may take it.
      if (!(vars && vars.allowVerifiedNonPro) && offersVerifiedRider(data)) void askVerifiedRider();
    },
    onError: (e) => setError(deliveryErrorMessage(e)),
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
    mutationFn: (offerId: string) => ordersApi.selectRider(order.id, offerId),
    onSuccess: (data) => {
      setError(null);
      setDetails(null);
      qc.setQueryData(key, data);
      toastSuccess('Rider chosen. They are on their way to pick up.');
      refreshAll();
    },
    onError: (e, offerId) => {
      setDetails(null);
      if (isNotSealed(e)) {
        setPendingOffer(offerId);
        setSealing(true);
      }
      setError(deliveryErrorMessage(e));
      void current.refetch();
    },
  });

  const onSealed = () => {
    setSealing(false);
    setSealed(true);
    setError(null);
    toastSuccess('Parcel sealed');
    refreshAll();
    if (pendingOffer) {
      const offer = pendingOffer;
      setPendingOffer(null);
      select.mutate(offer);
    }
  };

  const handover = useMutation({
    mutationFn: (riderName: string) =>
      ordersApi.handover(order.id, { handoverNote: `Collected by StyleMint rider ${riderName}`.slice(0, 200) }),
    onSuccess: () => {
      toastSuccess('Parcel handed over');
      refreshAll();
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });

  const choose = async (r: InterestedRider) => {
    const ok = await confirmAction({
      title: `Choose ${r.displayName}?`,
      body: 'The rider is told to come and pick up this parcel. Other riders are released.',
      confirmLabel: 'Choose rider',
    });
    if (ok) select.mutate(r.offerId);
  };

  const req = current.data;
  const firstName = req?.assigned?.displayName.split(' ')[0] ?? 'rider';

  return (
    <Drawer opened={opened} onClose={onClose} position="right" size="md" title={`Delivery partner · #${order.orderNumber}`}>
      <Stack gap="md">
        {error && (
          <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
            {error}
          </Alert>
        )}
        {(!req || req.state !== 'Assigned') && order.fulfillmentChannel === 'Delivery' && (
          <Card withBorder padding="sm" data-testid="seal-section">
            {sealing ? (
              <Stack gap="xs">
                <Text fw={650} size="sm">
                  Seal the parcel
                </Text>
                <SealForm
                  orderId={order.id}
                  onSealed={onSealed}
                  onCancel={() => {
                    setSealing(false);
                    setPendingOffer(null);
                  }}
                  submitLabel={pendingOffer ? 'Seal and choose rider' : 'Seal parcel'}
                />
              </Stack>
            ) : (
              <Group justify="space-between" wrap="nowrap" gap="sm">
                <Text size="sm" c={sealed ? 'var(--sm-good-text)' : 'dimmed'}>
                  {sealed
                    ? 'Parcel sealed. You can choose a rider.'
                    : 'A rider can only be chosen for a sealed parcel. Packed without a seal? Add it here first.'}
                </Text>
                <Button size="xs" variant={sealed ? 'subtle' : 'light'} onClick={() => setSealing(true)} style={{ flexShrink: 0 }}>
                  {sealed ? 'Seal again' : 'Add seal'}
                </Button>
              </Group>
            )}
          </Card>
        )}
        {current.isPending ? (
          <Group gap="xs">
            <Loader size="sm" />
            <Text size="sm">Checking for a delivery request…</Text>
          </Group>
        ) : current.error ? (
          <ErrorBlock error={current.error} onRetry={() => void current.refetch()} title="Could not check the delivery request" />
        ) : !req || req.state === 'Expired' || req.state === 'NoRiders' ? (
          <Stack gap="sm">
            {req?.state === 'NoRiders' && req.noRidersReason === NO_PRO_RIDER_HIGH_VALUE ? (
              <Alert color="amber" variant="light" title="No Pro rider is available for this high-value parcel" data-testid="no-pro-rider">
                <Stack gap="xs">
                  <Text size="sm">
                    High-value parcels go to Pro riders only.
                    {req.canUseVerifiedRider ? ' You can hand it to a verified rider instead, or try again later.' : ' Try again later.'}
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
            ) : req?.state === 'NoRiders' && req.noRidersReason === NO_VERIFIED_RIDER_HIGH_VALUE ? (
              <Alert color="amber" variant="light">
                No verified rider is available nearby either. Try again in a few minutes, or use your own courier.
              </Alert>
            ) : (
              req?.state === 'NoRiders' && (
                <Alert color="amber" variant="light">
                  No riders were available nearby. Try again in a few minutes, or use your own courier.
                </Alert>
              )
            )}
            {req?.state === 'Expired' && (
              <Alert color="amber" variant="light">
                Nobody was chosen before the request expired. Search again to notify riders.
              </Alert>
            )}
            <Text size="sm" c="dimmed">
              We notify StyleMint riders within about 5 km. Riders who can pick up step forward — you see their rating and
              details and choose one.
            </Text>
            <Button size="md" loading={open.isPending} onClick={() => open.mutate()} leftSection={<IconRefresh size={16} />}>
              {req ? 'Search again' : 'Find a delivery partner'}
            </Button>
          </Stack>
        ) : req.state === 'Assigned' && req.assigned ? (
          <Stack gap="sm">
            <Card>
              <Group wrap="nowrap">
                <Avatar src={req.assigned.avatarUrl ?? undefined} radius="xl" size="lg" color="forest">
                  {initialsOf(req.assigned.displayName)}
                </Avatar>
                <div>
                  <Text fw={700}>{req.assigned.displayName}</Text>
                  <Text size="sm" c="dimmed">
                    Your delivery partner{req.assigned.phone ? ` · ${req.assigned.phone}` : ''}
                  </Text>
                </div>
              </Group>
            </Card>
            <Text size="sm" c="dimmed">
              When {firstName} arrives and takes the parcel, confirm the handover.
            </Text>
            <Button size="md" loading={handover.isPending} onClick={() => handover.mutate(req.assigned!.displayName)}>
              Handed to {firstName}
            </Button>
          </Stack>
        ) : (
          <Stack gap="sm">
            <Group justify="space-between">
              <Group gap="xs">
                <ThemeIcon variant="light" radius="xl" size="sm">
                  <Loader size={10} />
                </ThemeIcon>
                <Text size="sm" fw={600}>
                  {req.state === 'Searching' ? 'Looking for riders…' : `${req.interested.length} interested`}
                </Text>
              </Group>
              <Text size="xs" c="dimmed">
                {req.notifiedCount} notified within {req.radiusKm} km · <Countdown until={req.expiresUtc} />
              </Text>
            </Group>
            {req.verifiedRiderConsent && (
              <Text size="xs" c="dimmed" data-testid="verified-rider-consent">
                High-value parcel: you agreed to a verified rider {fromNow(req.verifiedRiderConsent.consentedUtc)}.
              </Text>
            )}
            {req.interested.length === 0 ? (
              <Text size="sm" c="dimmed">
                Riders who can pick up will appear here. This updates by itself — opened {fromNow(req.openedUtc)}.
              </Text>
            ) : (
              req.interested.map((r) => (
                <RiderRow
                  key={r.offerId}
                  rider={r}
                  onDetails={() => setDetails(r)}
                  onChoose={() => void choose(r)}
                  choosing={select.isPending && select.variables === r.offerId}
                />
              ))
            )}
          </Stack>
        )}
      </Stack>
      <RiderDetailsModal
        orderId={order.id}
        rider={details}
        onClose={() => setDetails(null)}
        onChoose={(r) => void choose(r)}
        choosing={select.isPending}
      />
    </Drawer>
  );
}
