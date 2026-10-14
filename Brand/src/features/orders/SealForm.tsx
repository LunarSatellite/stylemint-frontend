import { useState } from 'react';
import { Alert, Button, FileInput, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconAlertTriangle, IconCamera } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { messageOf } from '../../api/client';
import { FilePreview } from '../../components/FilePreview';
import { ordersApi } from './api';

/** Checks the seal photo and number the same way the pack dialog does. Returns an error sentence or null. */
export function checkSeal(photo: File | null, sealId: string): string | null {
  if (!photo) return 'Add a photo of the sealed parcel.';
  if (photo.size > 5 * 1024 * 1024) return 'The photo must be 5 MB or smaller.';
  if (!/^image\/(jpeg|png)$/.test(photo.type)) return 'The photo must be a JPG or PNG.';
  if (!sealId.trim()) return 'Enter the number printed on the seal.';
  if (sealId.trim().length > 64) return 'The seal number is too long.';
  return null;
}

/**
 * Seal an already-packed parcel: upload the seal photo, then `POST …/{id}/seal`. A StyleMint rider can only be
 * chosen for a sealed parcel, and a parcel packed with "Skip sealing" (or packed before sealing existed) has
 * none — this lets the seller seal it from the delivery-partner screen instead of getting stuck.
 */
export function SealForm({ orderId, onSealed, onCancel, submitLabel = 'Seal parcel' }: { orderId: string; onSealed: () => void; onCancel?: () => void; submitLabel?: string }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [sealId, setSealId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const seal = useMutation({
    mutationFn: async () => {
      setStage('Uploading seal photo…');
      const { url } = await ordersApi.uploadSealPhoto(photo!);
      setStage('Sealing parcel…');
      await ordersApi.seal(orderId, sealId.trim(), url);
    },
    onSuccess: () => {
      setStage(null);
      onSealed();
    },
    onError: (e) => {
      setStage(null);
      setError(messageOf(e));
    },
  });
  const submit = () => {
    const problem = checkSeal(photo, sealId);
    setError(problem);
    if (!problem) seal.mutate();
  };
  return (
    <Stack gap="sm" data-testid="seal-form">
      {error && (
        <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
          {error}
        </Alert>
      )}
      <Text size="sm" c="dimmed">
        Close the parcel with a StyleMint seal, take a photo of it, and enter the seal’s number. Riders check the seal at pickup and
        the customer at delivery.
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
        capture="environment"
      />
      {photo && <FilePreview file={photo} alt="Seal photo preview" />}
      <TextInput label="Seal number" placeholder="e.g. SM-482913" value={sealId} onChange={(e) => setSealId(e.currentTarget.value)} maxLength={64} required />
      <Group justify="flex-end">
        {onCancel && (
          <Button variant="default" onClick={onCancel} disabled={seal.isPending}>
            Cancel
          </Button>
        )}
        <Button loading={seal.isPending} onClick={submit}>
          {submitLabel}
        </Button>
      </Group>
      {stage && (
        <Text size="xs" c="dimmed" ta="right" aria-live="polite">
          {stage}
        </Text>
      )}
    </Stack>
  );
}
