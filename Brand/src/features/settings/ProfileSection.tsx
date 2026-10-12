import { useEffect, useState } from 'react';
import { Alert, Avatar, BackgroundImage, Badge, Box, Button, FileButton, Group, SimpleGrid, Stack, Switch, Text, Textarea, TextInput } from '@mantine/core';
import { IconCamera, IconRosetteDiscountCheck } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { messageOf } from '../../api/client';
import { useSession } from '../../auth/useSession';
import { SectionCard } from '../../components/SectionCard';
import { ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { initialsOf } from '../../lib/format';
import { toastError, toastSuccess } from '../../lib/notify';
import { settingsApi, type ProfilePatch, type VendorProfile } from './api';

const FIELDS: { key: keyof ProfilePatch; label: string; max: number; multiline?: boolean; description?: string }[] = [
  { key: 'businessName', label: 'Shop name', max: 150 },
  { key: 'tagline', label: 'Tagline', max: 120, description: 'One line under your shop name.' },
  { key: 'description', label: 'About your shop', max: 1000, multiline: true },
  { key: 'brandStory', label: 'Your story', max: 2000, multiline: true, description: 'How you started, what makes your products special.' },
  { key: 'originCity', label: 'City', max: 80 },
  { key: 'websiteUrl', label: 'Website', max: 500 },
  { key: 'supportUrl', label: 'Support page (https://…)', max: 500 },
  { key: 'returnPolicySummary', label: 'Return policy (short)', max: 500, multiline: true },
  { key: 'businessRegistrationNumber', label: 'Business registration number', max: 80 },
  { key: 'taxId', label: 'PAN / VAT number', max: 80 },
];

function valuesOf(p: VendorProfile): Record<string, string> {
  return Object.fromEntries(FIELDS.map((f) => [f.key, (p[f.key as keyof VendorProfile] as string | null) ?? '']));
}

export function useVendorProfile() {
  const { accountId } = useSession();
  return useQuery({ queryKey: ['vendor-profile', accountId], queryFn: () => settingsApi.profile(accountId!), enabled: !!accountId });
}

export function ProfileSection() {
  const { accountId } = useSession();
  const qc = useQueryClient();
  const profile = useVendorProfile();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile.data) setValues(valuesOf(profile.data));
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => {
      const before = valuesOf(profile.data!);
      const patch: ProfilePatch = {};
      for (const f of FIELDS) {
        // "" clears a storefront field; untouched fields are not sent.
        if ((values[f.key] ?? '') !== before[f.key]) (patch as Record<string, string>)[f.key] = (values[f.key] ?? '').trim();
      }
      return settingsApi.updateProfile(accountId!, patch);
    },
    onSuccess: (data) => {
      qc.setQueryData(['vendor-profile', accountId], data);
      setError(null);
      toastSuccess('Shop profile saved');
    },
    onError: (e) => setError(messageOf(e)),
  });

  const upload = useMutation({
    mutationFn: ({ kind, file }: { kind: 'logo' | 'cover'; file: File }) => {
      if (file.size > 5 * 1024 * 1024) throw new Error('The image must be 5 MB or smaller.');
      return kind === 'logo' ? settingsApi.uploadLogo(file) : settingsApi.uploadCover(file);
    },
    onSuccess: (_, v) => {
      toastSuccess(v.kind === 'logo' ? 'Logo updated' : 'Banner updated');
      void qc.invalidateQueries({ queryKey: ['vendor-profile', accountId] });
    },
    onError: (e) => toastError(e, 'Upload failed'),
  });

  const pickup = useMutation({
    mutationFn: (body: { enabled: boolean; addressLine?: string; city?: string }) => settingsApi.setPickup(accountId!, body),
    onSuccess: (data) => {
      qc.setQueryData(['vendor-profile', accountId], data);
      toastSuccess('Pickup setting saved');
    },
    onError: (e) => toastError(e),
  });
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCity, setPickupCity] = useState('');
  useEffect(() => {
    if (profile.data) {
      setPickupAddress(profile.data.pickupAddressLine ?? '');
      setPickupCity(profile.data.pickupCity ?? '');
    }
  }, [profile.data]);

  if (profile.isPending) return <ListSkeleton rows={4} height={60} />;
  if (profile.error) return <ErrorBlock error={profile.error} onRetry={() => void profile.refetch()} title="Could not load your shop profile" />;
  const p = profile.data;

  return (
    <Stack gap="md">
      <SectionCard title="Logo and banner" description="JPG, PNG or WebP, up to 5 MB.">
        <Box style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--sm-border)' }}>
          <BackgroundImage src={p.coverImageUrl ?? ''} h={140} style={{ background: p.coverImageUrl ? undefined : 'linear-gradient(120deg, #cfeade, #eaf7f0)' }}>
            <Group justify="flex-end" p="xs">
              <FileButton onChange={(f) => f && upload.mutate({ kind: 'cover', file: f })} accept="image/jpeg,image/png,image/webp">
                {(props) => (
                  <Button {...props} size="xs" variant="white" leftSection={<IconCamera size={14} />} loading={upload.isPending && upload.variables?.kind === 'cover'}>
                    Change banner
                  </Button>
                )}
              </FileButton>
            </Group>
          </BackgroundImage>
          <Group p="md" gap="md" wrap="nowrap">
            <Avatar src={p.logoUrl ?? undefined} size={72} radius="lg" color="forest" style={{ marginTop: -48, border: '3px solid var(--sm-raised)' }}>
              {initialsOf(p.businessName)}
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Group gap={6}>
                <Text fw={700} truncate>
                  {p.businessName}
                </Text>
                {p.isVerified && (
                  <Badge color="forest" variant="light" leftSection={<IconRosetteDiscountCheck size={12} />}>
                    Verified
                  </Badge>
                )}
              </Group>
              {p.tagline && (
                <Text size="sm" c="dimmed" truncate>
                  {p.tagline}
                </Text>
              )}
            </div>
            <FileButton onChange={(f) => f && upload.mutate({ kind: 'logo', file: f })} accept="image/jpeg,image/png,image/webp">
              {(props) => (
                <Button {...props} size="xs" variant="default" loading={upload.isPending && upload.variables?.kind === 'logo'}>
                  Change logo
                </Button>
              )}
            </FileButton>
          </Group>
        </Box>
      </SectionCard>

      <SectionCard title="Shop profile" description="Shown to customers on your shop page.">
        <Stack gap="sm">
          {error && (
            <Alert color="signal" variant="light">
              {error}
            </Alert>
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {FIELDS.filter((f) => !f.multiline).map((f) => (
              <TextInput
                key={f.key}
                label={f.label}
                description={f.description}
                maxLength={f.max}
                value={values[f.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.currentTarget.value }))}
              />
            ))}
          </SimpleGrid>
          {FIELDS.filter((f) => f.multiline).map((f) => (
            <Textarea
              key={f.key}
              label={f.label}
              description={f.description}
              maxLength={f.max}
              autosize
              minRows={2}
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.currentTarget.value }))}
            />
          ))}
          <Group justify="flex-end">
            <Button onClick={() => save.mutate()} loading={save.isPending}>
              Save profile
            </Button>
          </Group>
        </Stack>
      </SectionCard>

      <SectionCard title="Store pickup" description="Let customers collect orders from your shop.">
        <Stack gap="sm">
          <Switch
            label="Customers can pick up orders"
            checked={p.isPickupEnabled}
            onChange={(e) =>
              pickup.mutate(
                e.currentTarget.checked
                  ? { enabled: true, addressLine: pickupAddress.trim() || undefined, city: pickupCity.trim() || undefined }
                  : { enabled: false },
              )
            }
            disabled={pickup.isPending}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput label="Pickup address" value={pickupAddress} onChange={(e) => setPickupAddress(e.currentTarget.value)} />
            <TextInput label="City" value={pickupCity} onChange={(e) => setPickupCity(e.currentTarget.value)} />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button
              variant="default"
              loading={pickup.isPending}
              onClick={() => pickup.mutate({ enabled: p.isPickupEnabled, addressLine: pickupAddress.trim(), city: pickupCity.trim() })}
            >
              Save pickup address
            </Button>
          </Group>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
