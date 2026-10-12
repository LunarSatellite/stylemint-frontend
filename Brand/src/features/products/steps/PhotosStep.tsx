import { useState } from 'react';
import { ActionIcon, Alert, Badge, Box, Button, Group, Image, Progress, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { IconAlertTriangle, IconArrowLeft, IconArrowRight, IconPhotoPlus, IconStar, IconStarFilled, IconTrash } from '@tabler/icons-react';
import { messageOf } from '../../../api/client';
import type { Product } from '../api';
import { productsApi } from '../api';
import { imagesSchema, issuesOf, MAX_IMAGES, MIN_IMAGES } from '../schemas';

export interface PhotoItem {
  url: string;
  primary: boolean;
}

const ACCEPT = IMAGE_MIME_TYPE.filter((t) => t === 'image/jpeg' || t === 'image/png');
const MAX_BYTES = 5 * 1024 * 1024;

export function PhotosStep({
  product,
  onSave,
  saving,
  serverError,
}: {
  product: Product;
  onSave: (images: PhotoItem[]) => void;
  saving: boolean;
  serverError: string | null;
}) {
  const [items, setItems] = useState<PhotoItem[]>(() =>
    [...product.images].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => ({ url: i.cdnUrl, primary: i.isPrimary })),
  );
  const [uploading, setUploading] = useState(0);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: File[]) => {
    setUploadErrors([]);
    const room = MAX_IMAGES - items.length;
    const accepted = files.slice(0, Math.max(0, room));
    const problems: string[] = [];
    if (files.length > room) problems.push(`Only ${MAX_IMAGES} photos are allowed — ${files.length - room} not added.`);
    setUploading((n) => n + accepted.length);
    await Promise.all(
      accepted.map(async (file) => {
        try {
          if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 5 MB.`);
          const { url } = await productsApi.uploadImage(file);
          setItems((list) => [...list, { url, primary: list.length === 0 }]);
        } catch (e) {
          problems.push(`${file.name}: ${messageOf(e)}`);
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
    setUploadErrors(problems);
  };

  const move = (i: number, dir: -1 | 1) =>
    setItems((list) => {
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const copy = [...list];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const makePrimary = (i: number) => setItems((list) => list.map((p, k) => ({ ...p, primary: k === i })));
  const remove = (i: number) =>
    setItems((list) => {
      const next = list.filter((_, k) => k !== i);
      if (next.length && !next.some((p) => p.primary)) next[0] = { ...next[0], primary: true };
      return next;
    });

  const submit = () => {
    const parsed = imagesSchema.safeParse({ images: items });
    if (!parsed.success) {
      setError(issuesOf(parsed.error).images ?? 'Check your photos');
      return;
    }
    setError(null);
    onSave(items);
  };

  return (
    <Stack gap="md">
      {(serverError || error) && (
        <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
          {serverError ?? error}
        </Alert>
      )}
      <Text size="sm" c="dimmed">
        Add {MIN_IMAGES}–{MAX_IMAGES} clear photos (JPG or PNG, up to 5 MB each). The starred photo is shown first. Use
        good light and a plain background; show the product from several sides.
      </Text>
      <Dropzone
        onDrop={(files) => void upload(files)}
        onReject={(rejections) =>
          setUploadErrors(rejections.map((r) => `${r.file.name}: ${r.errors[0]?.code === 'file-too-large' ? 'larger than 5 MB' : 'only JPG or PNG photos'}`))
        }
        accept={ACCEPT}
        maxSize={MAX_BYTES}
        disabled={items.length >= MAX_IMAGES}
        multiple
        radius="lg"
      >
        <Group justify="center" gap="md" mih={110} style={{ pointerEvents: 'none' }}>
          <IconPhotoPlus size={36} stroke={1.4} color="var(--sm-accent)" />
          <div>
            <Text fw={600}>{items.length >= MAX_IMAGES ? 'You have 10 photos' : 'Tap to add photos, or drop them here'}</Text>
            <Text size="sm" c="dimmed">
              {items.length} of {MAX_IMAGES} · at least {MIN_IMAGES}
            </Text>
          </div>
        </Group>
      </Dropzone>
      {uploading > 0 && (
        <Stack gap={4}>
          <Text size="sm">Uploading {uploading} {uploading === 1 ? 'photo' : 'photos'}…</Text>
          <Progress value={100} animated striped />
        </Stack>
      )}
      {uploadErrors.length > 0 && (
        <Alert color="amber" variant="light" title="Some photos were not added">
          {uploadErrors.map((e) => (
            <Text key={e} size="sm">
              {e}
            </Text>
          ))}
        </Alert>
      )}
      <SimpleGrid cols={{ base: 2, xs: 3, md: 5 }} spacing="sm">
        {items.map((p, i) => (
          <Box key={p.url} pos="relative" style={{ border: `2px solid ${p.primary ? 'var(--sm-accent)' : 'var(--sm-border)'}`, borderRadius: 12, overflow: 'hidden' }}>
            <Image src={p.url} alt={`Product photo ${i + 1}`} h={130} fit="cover" />
            {p.primary && (
              <Badge pos="absolute" top={6} left={6} size="xs" color="forest">
                Main photo
              </Badge>
            )}
            <Group gap={2} justify="space-between" p={4} style={{ background: 'var(--sm-raised)' }}>
              <Tooltip label="Move left">
                <ActionIcon variant="subtle" size="sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move photo left">
                  <IconArrowLeft size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={p.primary ? 'Main photo' : 'Make main photo'}>
                <ActionIcon variant="subtle" size="sm" color="amber" onClick={() => makePrimary(i)} aria-label="Make main photo">
                  {p.primary ? <IconStarFilled size={14} /> : <IconStar size={14} />}
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Remove">
                <ActionIcon variant="subtle" size="sm" color="signal" onClick={() => remove(i)} aria-label="Remove photo">
                  <IconTrash size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Move right">
                <ActionIcon variant="subtle" size="sm" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move photo right">
                  <IconArrowRight size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Box>
        ))}
      </SimpleGrid>
      <Group justify="flex-end">
        <Button onClick={submit} loading={saving} disabled={uploading > 0}>
          Save and continue
        </Button>
      </Group>
    </Stack>
  );
}
