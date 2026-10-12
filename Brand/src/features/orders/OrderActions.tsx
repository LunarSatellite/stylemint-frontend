import { useState } from 'react';
import { Alert, Button, Checkbox, FileInput, Group, Modal, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import {
  IconAlertTriangle,
  IconBuildingStore,
  IconCamera,
  IconCheck,
  IconCircleCheck,
  IconPackage,
  IconPrinter,
  IconRoute,
  IconTruck,
  IconTruckDelivery,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { messageOf } from '../../api/client';
import { FilePreview } from '../../components/FilePreview';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import { availableActions, ordersApi, rejectionReasons, SubOrderState, VendorRejectionReason, type SubOrderDetail } from './api';

/** Runs one fulfilment step: toast, then re-read every order view. */
function useStep(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (step: { run: () => Promise<unknown>; done: string }) => {
      await step.run();
      return step.done;
    },
    onSuccess: (done) => {
      toastSuccess(done);
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['delivery'] });
      void qc.invalidateQueries({ queryKey: ['home'] });
      void qc.invalidateQueries({ queryKey: ['order', orderId] });
    },
    onError: (e) => toastError(e),
  });
}

export function OrderActionBar({ order, onFindRider }: { order: SubOrderDetail; onFindRider: () => void }) {
  const step = useStep(order.id);
  const navigate = useNavigate();
  const [modal, setModal] = useState<null | 'reject' | 'pack' | 'handover' | 'tracking'>(null);
  const actions = availableActions(order.state, order.fulfillmentChannel);
  const busy = step.isPending;

  const confirmed = async (title: string, body: string, confirmLabel: string, run: () => Promise<unknown>, done: string) => {
    if (await confirmAction({ title, body, confirmLabel })) step.mutate({ run, done });
  };

  const buttons: React.ReactNode[] = [];
  for (const a of actions) {
    switch (a) {
      case 'accept':
        buttons.push(
          <Button
            key={a}
            leftSection={<IconCheck size={16} />}
            loading={busy}
            onClick={() =>
              void confirmed(
                'Accept this order?',
                'The customer will be told you are preparing it. Accept only if you can ship it.',
                'Accept order',
                () => ordersApi.accept(order.id),
                'Order accepted',
              )
            }
          >
            Accept order
          </Button>,
        );
        break;
      case 'reject':
        buttons.push(
          <Button key={a} variant="light" color="signal" leftSection={<IconX size={16} />} onClick={() => setModal('reject')}>
            Reject
          </Button>,
        );
        break;
      case 'pack':
        buttons.push(
          <Button key={a} leftSection={<IconPackage size={16} />} onClick={() => setModal('pack')}>
            {order.fulfillmentChannel === 'Delivery' ? 'Seal & mark packed' : 'Mark packed'}
          </Button>,
        );
        break;
      case 'findRider':
        buttons.push(
          <Button key={a} leftSection={<IconTruckDelivery size={16} />} onClick={onFindRider}>
            Find a delivery partner
          </Button>,
        );
        break;
      case 'handover':
        buttons.push(
          <Button key={a} variant="default" leftSection={<IconTruck size={16} />} onClick={() => setModal('handover')}>
            Use my own courier
          </Button>,
        );
        break;
      case 'readyToShip':
        buttons.push(
          <Button
            key={a}
            variant="default"
            loading={busy}
            onClick={() =>
              void confirmed(
                'Mark ready to ship?',
                'Use this when the order waits for a courier you arrange yourself.',
                'Ready to ship',
                () => ordersApi.readyToShip(order.id),
                'Marked ready to ship',
              )
            }
          >
            Ready to ship
          </Button>,
        );
        break;
      case 'tracking':
        buttons.push(
          <Button key={a} leftSection={<IconRoute size={16} />} onClick={() => setModal('tracking')}>
            Add tracking
          </Button>,
        );
        break;
      case 'collected':
        buttons.push(
          <Button
            key={a}
            leftSection={<IconBuildingStore size={16} />}
            loading={busy}
            onClick={() =>
              void confirmed(
                'Customer collected the order?',
                'Confirm only when the customer has picked the order up at your store.',
                'Yes, collected',
                () => ordersApi.collected(order.id),
                'Marked as collected',
              )
            }
          >
            Customer collected
          </Button>,
        );
        break;
      case 'inTransit':
        buttons.push(
          <Button
            key={a}
            variant="default"
            loading={busy}
            onClick={() =>
              void confirmed(
                'Mark in transit?',
                'Usually updated by the courier. Use this only if the courier did not update it.',
                'Mark in transit',
                () => ordersApi.inTransit(order.id),
                'Marked in transit',
              )
            }
          >
            In transit
          </Button>,
        );
        break;
      case 'outForDelivery':
        buttons.push(
          <Button
            key={a}
            variant="default"
            loading={busy}
            onClick={() =>
              void confirmed(
                'Mark out for delivery?',
                'Usually updated by the courier. Use this only if the courier did not update it.',
                'Mark out for delivery',
                () => ordersApi.outForDelivery(order.id),
                'Marked out for delivery',
              )
            }
          >
            Out for delivery
          </Button>,
        );
        break;
      case 'delivered':
        buttons.push(
          <Button
            key={a}
            variant="default"
            leftSection={<IconCircleCheck size={16} />}
            loading={busy}
            onClick={() =>
              void confirmed(
                'Mark delivered?',
                'StyleMint rider deliveries are confirmed by the customer automatically. Mark delivered only for your own courier, once the customer has the parcel.',
                'Mark delivered',
                () => ordersApi.delivered(order.id),
                'Marked delivered',
              )
            }
          >
            Mark delivered
          </Button>,
        );
        break;
    }
  }

  const canPrint = order.state !== SubOrderState.Cancelled && order.state !== SubOrderState.Pending;

  return (
    <>
      <Group gap="sm" wrap="wrap" data-testid="order-actions">
        {buttons}
        {canPrint && (
          <Button variant="subtle" leftSection={<IconPrinter size={16} />} onClick={() => navigate(`/orders/packing-slips?ids=${order.id}`)}>
            Packing slip
          </Button>
        )}
      </Group>
      <RejectModal opened={modal === 'reject'} onClose={() => setModal(null)} order={order} />
      <PackModal opened={modal === 'pack'} onClose={() => setModal(null)} order={order} />
      <OwnCourierModal opened={modal === 'handover'} onClose={() => setModal(null)} order={order} />
      <TrackingModal opened={modal === 'tracking'} onClose={() => setModal(null)} order={order} />
    </>
  );
}

function useInvalidateOrder(orderId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['orders'] });
    void qc.invalidateQueries({ queryKey: ['delivery'] });
    void qc.invalidateQueries({ queryKey: ['home'] });
    void qc.invalidateQueries({ queryKey: ['order', orderId] });
  };
}

export function RejectModal({ opened, onClose, order }: { opened: boolean; onClose: () => void; order: SubOrderDetail }) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateOrder(order.id);
  const reject = useMutation({
    mutationFn: () => ordersApi.reject(order.id, Number(reason), note.trim() || null),
    onSuccess: () => {
      toastSuccess('Order rejected. The customer will be refunded.');
      invalidate();
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const needsNote = Number(reason) === VendorRejectionReason.Other;
  const submit = () => {
    setError(null);
    if (!reason) return setError('Choose a reason.');
    if (needsNote && !note.trim()) return setError('Tell the customer why.');
    if (note.length > 200) return setError('Keep the note under 200 characters.');
    reject.mutate();
  };
  return (
    <Modal opened={opened} onClose={onClose} title="Reject this order?">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          The order is cancelled and the customer gets a full refund. Rejecting often can lower your shop’s ranking.
        </Text>
        {error && (
          <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
            {error}
          </Alert>
        )}
        <Select label="Reason" placeholder="Choose a reason" data={rejectionReasons} value={reason} onChange={setReason} required allowDeselect={false} />
        <Textarea
          label="Note to the customer"
          description={needsNote ? 'Required for “Other reason”.' : 'Optional.'}
          maxLength={200}
          autosize
          minRows={2}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          required={needsNote}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Keep order
          </Button>
          <Button color="signal" loading={reject.isPending} onClick={submit}>
            Reject order
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/**
 * Mark packed. For delivery orders the parcel is sealed first (photo of the seal + the seal's
 * number): a StyleMint rider can only be chosen for a sealed parcel. Mirrors the mobile app's
 * upload photo → seal → packed sequence.
 */
export function PackModal({ opened, onClose, order }: { opened: boolean; onClose: () => void; order: SubOrderDetail }) {
  const delivery = order.fulfillmentChannel === 'Delivery';
  const [photo, setPhoto] = useState<File | null>(null);
  const [sealId, setSealId] = useState('');
  const [skipSeal, setSkipSeal] = useState(!delivery);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const invalidate = useInvalidateOrder(order.id);

  const pack = useMutation({
    mutationFn: async () => {
      if (!skipSeal) {
        setStage('Uploading seal photo…');
        const { url } = await ordersApi.uploadSealPhoto(photo!);
        setStage('Sealing parcel…');
        await ordersApi.seal(order.id, sealId.trim(), url);
      }
      setStage('Marking packed…');
      await ordersApi.packed(order.id);
    },
    onSuccess: () => {
      toastSuccess(skipSeal ? 'Marked packed' : 'Parcel sealed and marked packed');
      invalidate();
      setStage(null);
      onClose();
    },
    onError: (e) => {
      setStage(null);
      setError(messageOf(e));
      invalidate();
    },
  });

  const submit = () => {
    setError(null);
    if (!skipSeal) {
      if (!photo) return setError('Add a photo of the sealed parcel.');
      if (photo.size > 5 * 1024 * 1024) return setError('The photo must be 5 MB or smaller.');
      if (!/^image\/(jpeg|png)$/.test(photo.type)) return setError('The photo must be a JPG or PNG.');
      if (!sealId.trim()) return setError('Enter the number printed on the seal.');
      if (sealId.trim().length > 64) return setError('The seal number is too long.');
    }
    pack.mutate();
  };

  return (
    <Modal opened={opened} onClose={onClose} title={delivery ? 'Seal the parcel and mark packed' : 'Mark packed'}>
      <Stack gap="md">
        {error && (
          <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
            {error}
          </Alert>
        )}
        {delivery && !skipSeal && (
          <>
            <Text size="sm" c="dimmed">
              Close the parcel with a StyleMint seal, take a photo of it, and enter the seal’s number. Riders check the
              seal at pickup and the customer at delivery.
            </Text>
            <FileInput
              label="Photo of the sealed parcel"
              placeholder="Take or choose a photo"
              accept="image/jpeg,image/png"
              leftSection={<IconCamera size={16} />}
              value={photo}
              onChange={setPhoto}
              clearable
              required
              // Opens the camera directly on phones.
              capture="environment"
            />
            {photo && <FilePreview file={photo} alt="Seal photo preview" />}
            <TextInput
              label="Seal number"
              placeholder="e.g. SM-482913"
              value={sealId}
              onChange={(e) => setSealId(e.currentTarget.value)}
              maxLength={64}
              required
            />
          </>
        )}
        {delivery && (
          <Checkbox
            checked={skipSeal}
            onChange={(e) => setSkipSeal(e.currentTarget.checked)}
            label="Skip sealing — I will send this with my own courier"
            description="A StyleMint rider can only be chosen for a sealed parcel."
          />
        )}
        {!delivery && (
          <Text size="sm">The customer collects this order at your store. Mark it packed when it is ready.</Text>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={pack.isPending}>
            Cancel
          </Button>
          <Button loading={pack.isPending} onClick={submit}>
            {skipSeal ? 'Mark packed' : 'Seal & mark packed'}
          </Button>
        </Group>
        {stage && (
          <Text size="xs" c="dimmed" ta="right" aria-live="polite">
            {stage}
          </Text>
        )}
      </Stack>
    </Modal>
  );
}

export function OwnCourierModal({ opened, onClose, order }: { opened: boolean; onClose: () => void; order: SubOrderDetail }) {
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateOrder(order.id);
  const handover = useMutation({
    mutationFn: () =>
      ordersApi.handover(order.id, {
        carrier: carrier.trim() || null,
        trackingNumber: tracking.trim() || null,
        handoverNote: note.trim() || null,
      }),
    onSuccess: () => {
      toastSuccess('Handed over to your courier');
      invalidate();
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const submit = () => {
    setError(null);
    if (!!carrier.trim() !== !!tracking.trim()) return setError('Enter both the courier name and the tracking number, or neither.');
    handover.mutate();
  };
  return (
    <Modal opened={opened} onClose={onClose} title="Hand over to your own courier">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Use this when you send the parcel with a courier you arranged yourself.
        </Text>
        {error && (
          <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
            {error}
          </Alert>
        )}
        <TextInput label="Courier" placeholder="e.g. Nepal Can Move" maxLength={100} value={carrier} onChange={(e) => setCarrier(e.currentTarget.value)} />
        <TextInput label="Tracking number" maxLength={200} value={tracking} onChange={(e) => setTracking(e.currentTarget.value)} />
        <Textarea label="Note" description="Optional" maxLength={200} autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={handover.isPending} onClick={submit}>
            Hand over
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function TrackingModal({ opened, onClose, order }: { opened: boolean; onClose: () => void; order: SubOrderDetail }) {
  const [carrier, setCarrier] = useState(order.carrier ?? '');
  const [tracking, setTracking] = useState(order.trackingNumber ?? '');
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateOrder(order.id);
  const save = useMutation({
    mutationFn: () => ordersApi.tracking(order.id, carrier.trim(), tracking.trim()),
    onSuccess: () => {
      toastSuccess('Tracking added — the order is shipped');
      invalidate();
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const submit = () => {
    setError(null);
    if (!carrier.trim() || !tracking.trim()) return setError('Enter the courier and the tracking number.');
    save.mutate();
  };
  return (
    <Modal opened={opened} onClose={onClose} title="Add tracking">
      <Stack gap="md">
        {error && (
          <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
            {error}
          </Alert>
        )}
        <TextInput label="Courier" maxLength={100} required value={carrier} onChange={(e) => setCarrier(e.currentTarget.value)} />
        <TextInput label="Tracking number" maxLength={200} required value={tracking} onChange={(e) => setTracking(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            Save and mark shipped
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
