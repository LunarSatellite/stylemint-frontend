import { useState, type ReactNode } from 'react';
import { Alert, Button, Card, Group, Modal, NumberInput, SimpleGrid, Stack, Table, Text, Textarea } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ApiError, isMissingEndpoint, messageOf } from '../../../api/client';
import { PageHeader } from '../../../components/PageHeader';
import { SectionCard } from '../../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../../components/StateBlocks';
import { formatDateTime, formatMoney } from '../../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../../lib/notify';
import { ServiceCategory } from '../category';
import { formatDay, RequireServiceCategory, ServiceSettingUp } from '../components';
import {
  BOOKINGS_KEY,
  bookingsApi,
  BookingState,
  cancelledByLabel,
  ListingKind,
  PaymentMode,
  paymentModeLabel,
  refundStateLabel,
  TravellerType,
  type Booking,
} from '../listings/api';
import { BookingStateBadge, guestsText } from './BookingsPage';

const ACTION_ERRORS: Record<string, string> = {
  'booking.too_early': 'This can only be done from the start date.',
  'booking.invalid_transition': 'The booking changed in the meantime — refresh and try again.',
  'booking.not_cancellable': 'This booking can no longer be cancelled.',
  'booking.balance_not_due': 'Nothing is left to collect, or the amount is more than the balance.',
};
const friendly = (e: unknown) => (e instanceof ApiError && e.code && ACTION_ERRORS[e.code] ? new Error(ACTION_ERRORS[e.code]) : e);

/**
 * What the vendor earns: commission is taken only when the booking settles (completed, no-show, or cancelled with
 * a retained fee). Before that the figures are an estimate from the percent snapshotted on the booking.
 */
export function earningsOf(b: Booking): { base: number; commission: number | null; net: number | null; settled: boolean; estimated: boolean } {
  const settled = !!b.settledUtc && b.commissionAmount !== null;
  if (settled) return { base: b.totalPrice, commission: b.commissionAmount, net: b.vendorNetAmount, settled: true, estimated: false };
  if (b.state === BookingState.Cancelled || b.state === BookingState.Expired || b.commissionPercent === null)
    return { base: b.totalPrice, commission: null, net: null, settled: false, estimated: false };
  const commission = Math.round(b.totalPrice * b.commissionPercent) / 100;
  return { base: b.totalPrice, commission, net: Math.round((b.totalPrice - commission) * 100) / 100, settled: false, estimated: true };
}

export default function BookingDetailPage() {
  return (
    <RequireServiceCategory allow={[ServiceCategory.Hotel, ServiceCategory.TravelAgency]}>
      <BookingDetailBody />
    </RequireServiceCategory>
  );
}

function BookingDetailBody() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: [...BOOKINGS_KEY, 'detail', id], queryFn: () => bookingsApi.get(id), refetchInterval: 30_000 });
  const b = q.data;
  return (
    <>
      <PageHeader
        title={b ? `Booking ${b.number}` : 'Booking'}
        back={{ to: '/services/bookings', label: 'Bookings' }}
        meta={
          b && (
            <Group gap={6}>
              <BookingStateBadge booking={b} />
              <Text size="xs" c="dimmed">
                Booked {formatDateTime(b.createdUtc)}
              </Text>
            </Group>
          )
        }
        actions={b && <BookingActions booking={b} />}
      />
      {q.isPending ? (
        <ListSkeleton rows={3} height={120} />
      ) : q.error ? (
        isMissingEndpoint(q.error) ? (
          <ServiceSettingUp what="Bookings" />
        ) : q.error instanceof ApiError && q.error.status === 404 ? (
          <Card>
            <EmptyBlock title="Booking not found" body="It may belong to another vendor, or the link is wrong." />
          </Card>
        ) : (
          <ErrorBlock error={q.error} title="Could not load this booking" onRetry={() => void q.refetch()} />
        )
      ) : b ? (
        <BookingView b={b} />
      ) : null}
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Group justify="space-between" gap="sm" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" ta="right">
        {children}
      </Text>
    </Group>
  );
}

function BookingView({ b }: { b: Booking }) {
  const stay = b.kind === ListingKind.Stay;
  const m = (amount: number | null | undefined) => (amount === null || amount === undefined ? '—' : formatMoney({ amount, currency: b.currency || 'NPR' }));
  const e = earningsOf(b);
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
      <Stack gap="lg">
        <SectionCard title={stay ? 'Guest' : 'Travellers'} description="Names only — StyleMint does not share guests' phone numbers or email addresses. Message them through StyleMint.">
          <Stack gap="xs" data-testid="booking-guests">
            <Text fw={650}>{b.guestName}</Text>
            <Text size="sm">{guestsText(b)}</Text>
            {b.travellers.length > 0 && (
              <Stack gap={2}>
                {b.travellers.map((t, i) => (
                  <Text size="sm" key={i}>
                    {t.fullName}
                    <Text span c="dimmed" size="sm">
                      {' '}
                      · {t.type === TravellerType.Child ? `child${t.age !== null ? `, ${t.age}` : ''}` : 'adult'}
                    </Text>
                  </Text>
                ))}
              </Stack>
            )}
            {b.specialRequests && (
              <Card withBorder padding="sm">
                <Text size="xs" c="dimmed" fw={600}>
                  Special requests
                </Text>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {b.specialRequests}
                </Text>
              </Card>
            )}
          </Stack>
        </SectionCard>
        <SectionCard title={stay ? 'Stay' : 'Trip'}>
          <Stack gap={6}>
            <Row label={stay ? 'Property' : 'Package'}>{b.listingTitle}</Row>
            {stay && <Row label="Room">{`${b.rooms && b.rooms > 1 ? `${b.rooms} × ` : ''}${b.roomTypeName ?? '—'}`}</Row>}
            <Row label={stay ? 'Check-in' : 'Departs'}>
              {formatDay(b.startDate)}
              {stay && b.checkInTime ? ` from ${b.checkInTime}` : ''}
            </Row>
            <Row label={stay ? 'Check-out' : 'Returns'}>
              {formatDay(b.endDate)}
              {stay && b.checkOutTime ? ` by ${b.checkOutTime}` : ''}
            </Row>
            {stay && <Row label="Nights">{b.nights ?? '—'}</Row>}
            {!stay && b.meetingPoint && <Row label="Meeting point">{b.meetingPoint}</Row>}
            {b.checkedInUtc && <Row label={stay ? 'Checked in' : 'Started'}>{formatDateTime(b.checkedInUtc)}</Row>}
            {b.completedUtc && <Row label="Completed">{formatDateTime(b.completedUtc)}</Row>}
            {b.noShowUtc && <Row label="No-show">{formatDateTime(b.noShowUtc)}</Row>}
          </Stack>
        </SectionCard>
      </Stack>
      <Stack gap="lg">
        <SectionCard title="Payment" description={paymentModeLabel[b.paymentMode]}>
          <Stack gap={6} data-testid="booking-payment">
            {b.lines.length > 0 && (
              <Table withRowBorders={false} verticalSpacing={2} mb={4}>
                <Table.Tbody>
                  {b.lines.map((l, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>
                        <Text size="sm">{l.label}</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" c="dimmed">
                          {l.quantity} × {m(l.unitPrice)}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm">{m(l.amount)}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
            <Row label="Total">
              <b>{m(b.totalPrice)}</b>
            </Row>
            {b.paymentMode === PaymentMode.Deposit && <Row label="Deposit">{`${b.depositPercent}%`}</Row>}
            <Row label="Paid online">{m(b.paidOnline)}</Row>
            {b.balanceReceivedAmount ? <Row label="Collected at the venue">{`${m(b.balanceReceivedAmount)}${b.balanceReceivedUtc ? ` · ${formatDateTime(b.balanceReceivedUtc)}` : ''}`}</Row> : null}
            <Row label="Still to collect">
              <Text span size="sm" c={b.balanceDue > 0 ? 'amber' : undefined} fw={b.balanceDue > 0 ? 650 : undefined}>
                {m(b.balanceDue)}
              </Text>
            </Row>
            {b.state === BookingState.PendingPayment && b.holdExpiresUtc && (
              <Text size="xs" c="dimmed">
                The guest has until {formatDateTime(b.holdExpiresUtc)} to pay; the rooms or seats are held until then.
              </Text>
            )}
          </Stack>
        </SectionCard>
        <SectionCard title="Your earnings" description="StyleMint's commission is taken only on completed bookings (and on a kept no-show or late-cancellation payment).">
          <Stack gap={6} data-testid="booking-earnings">
            <Row label="Booking amount">{m(e.base)}</Row>
            <Row label={`Commission${b.commissionPercent !== null ? ` (${b.commissionPercent}%)` : ''}`}>{e.commission === null ? '—' : `− ${m(e.commission)}`}</Row>
            <Row label="Your net">
              <b>{m(e.net)}</b>
            </Row>
            {e.settled ? (
              <Text size="xs" c="dimmed">
                Settled {formatDateTime(b.settledUtc)}. It appears in Payouts & earnings.
                {(b.vendorNetAmount ?? 0) < 0 ? ' You collected the money at the venue, so the commission is taken from your next payout.' : ''}
              </Text>
            ) : e.estimated ? (
              <Text size="xs" c="dimmed">
                Estimate — the final figures are set when the booking is completed.
              </Text>
            ) : null}
          </Stack>
        </SectionCard>
        <SectionCard title="Cancellation">
          <Stack gap={6}>
            {b.cancellationPolicy?.summary && <Text size="sm">{b.cancellationPolicy.summary}</Text>}
            {b.state === BookingState.Cancelled && (
              <>
                <Row label="Cancelled by">{b.cancelledBy ? cancelledByLabel[b.cancelledBy] ?? '—' : '—'}</Row>
                {b.cancelReason && <Row label="Reason">{b.cancelReason}</Row>}
                <Row label="Fee kept">{m(b.cancellationFee ?? 0)}</Row>
                <Row label="Refund">{`${m(b.refundAmount ?? 0)} · ${refundStateLabel[b.refundState] ?? ''}`}</Row>
              </>
            )}
          </Stack>
        </SectionCard>
      </Stack>
    </SimpleGrid>
  );
}

/** The lifecycle buttons the server allows for this booking right now (`can*` flags). */
export function BookingActions({ booking: b }: { booking: Booking }) {
  const qc = useQueryClient();
  const stay = b.kind === ListingKind.Stay;
  const [modal, setModal] = useState<'balance' | 'cancel' | null>(null);
  const update = (next: Booking, msg: string) => {
    qc.setQueryData([...BOOKINGS_KEY, 'detail', b.id], next);
    void qc.invalidateQueries({ queryKey: [...BOOKINGS_KEY, 'list'] });
    void qc.invalidateQueries({ queryKey: [...BOOKINGS_KEY, 'summary'] });
    toastSuccess(msg);
  };
  const checkIn = useMutation({ mutationFn: () => bookingsApi.checkIn(b.id), onSuccess: (n) => update(n, stay ? 'Guest checked in.' : 'Trip started.'), onError: (e) => toastError(friendly(e)) });
  const complete = useMutation({ mutationFn: () => bookingsApi.complete(b.id), onSuccess: (n) => update(n, 'Marked completed. Your earning is recorded.'), onError: (e) => toastError(friendly(e)) });
  const noShow = useMutation({ mutationFn: () => bookingsApi.noShow(b.id), onSuccess: (n) => update(n, 'Marked as no-show.'), onError: (e) => toastError(friendly(e)) });
  const any = b.canCheckIn || b.canComplete || b.canMarkNoShow || b.canMarkBalanceReceived || b.canCancel;
  if (!any) return null;
  return (
    <>
      <Group gap="xs" wrap="wrap">
        {b.canCheckIn && (
          <Button loading={checkIn.isPending} onClick={() => checkIn.mutate()}>
            {stay ? 'Check in' : 'Start trip'}
          </Button>
        )}
        {b.canComplete && (
          <Button
            variant={b.canCheckIn ? 'default' : 'filled'}
            loading={complete.isPending}
            onClick={async () => {
              const body = b.balanceDue > 0 ? `${formatMoney({ amount: b.balanceDue, currency: b.currency })} is still to collect — record it first with “Mark balance received”.` : 'The stay or trip is finished and your earning is recorded.';
              if (await confirmAction({ title: 'Mark as completed?', body, confirmLabel: 'Mark completed' })) complete.mutate();
            }}
          >
            Mark completed
          </Button>
        )}
        {b.canMarkBalanceReceived && (
          <Button variant="light" onClick={() => setModal('balance')}>
            Mark balance received
          </Button>
        )}
        {b.canMarkNoShow && (
          <Button
            variant="default"
            loading={noShow.isPending}
            onClick={async () => {
              if (await confirmAction({ title: 'Mark as no-show?', body: 'The guest did not arrive. Anything paid online is kept under your cancellation rule.', confirmLabel: 'Mark no-show' })) noShow.mutate();
            }}
          >
            No-show
          </Button>
        )}
        {b.canCancel && (
          <Button variant="subtle" color="signal" onClick={() => setModal('cancel')}>
            Cancel booking
          </Button>
        )}
      </Group>
      {modal === 'balance' && <BalanceModal booking={b} onClose={() => setModal(null)} onDone={(n) => update(n, 'Balance recorded.')} />}
      {modal === 'cancel' && <CancelModal booking={b} onClose={() => setModal(null)} onDone={(n) => update(n, 'Booking cancelled. The guest is refunded in full.')} />}
    </>
  );
}

function BalanceModal({ booking: b, onClose, onDone }: { booking: Booking; onClose: () => void; onDone: (b: Booking) => void }) {
  const [amount, setAmount] = useState<number | ''>(b.balanceDue);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => bookingsApi.balanceReceived(b.id, Number(amount), note.trim() || null),
    onSuccess: (n) => {
      onDone(n);
      onClose();
    },
    onError: (e) => setError(messageOf(friendly(e))),
  });
  return (
    <Modal opened onClose={onClose} title="Mark balance received">
      <Stack gap="sm">
        <Text size="sm">Record money the guest paid you directly (cash, card at the desk, bank transfer).</Text>
        {error && (
          <Alert color="signal" variant="light" role="alert">
            {error}
          </Alert>
        )}
        <NumberInput
          label="Amount received"
          description={`Balance due: ${formatMoney({ amount: b.balanceDue, currency: b.currency })}`}
          min={0.01}
          max={b.balanceDue}
          decimalScale={2}
          thousandSeparator=","
          value={amount}
          onChange={(v) => setAmount(v === '' ? '' : Number(v))}
        />
        <Textarea label="Note (optional)" autosize minRows={1} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            onClick={() => {
              const n = Number(amount);
              if (!(n > 0) || n > b.balanceDue) return setError(`Enter an amount above 0 and at most ${formatMoney({ amount: b.balanceDue, currency: b.currency })}.`);
              setError(null);
              save.mutate();
            }}
          >
            Record payment
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function CancelModal({ booking: b, onClose, onDone }: { booking: Booking; onClose: () => void; onDone: (b: Booking) => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cancel = useMutation({
    mutationFn: () => bookingsApi.cancel(b.id, reason.trim()),
    onSuccess: (n) => {
      onDone(n);
      onClose();
    },
    onError: (e) => setError(messageOf(friendly(e))),
  });
  return (
    <Modal opened onClose={onClose} title={`Cancel booking ${b.number}`}>
      <Stack gap="sm">
        <Alert color="signal" variant="light">
          The guest is told your reason and gets a full refund of everything paid online
          {b.paidOnline > 0 ? ` (${formatMoney({ amount: b.paidOnline, currency: b.currency })})` : ''}. No cancellation fee applies when you cancel.
        </Alert>
        {error && (
          <Text size="sm" c="signal">
            {error}
          </Text>
        )}
        <Textarea label="Reason" required maxLength={300} autosize minRows={2} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Keep booking
          </Button>
          <Button
            color="signal"
            loading={cancel.isPending}
            onClick={() => {
              if (!reason.trim()) return setError('Give a reason — the guest sees it.');
              setError(null);
              cancel.mutate();
            }}
          >
            Cancel booking
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
