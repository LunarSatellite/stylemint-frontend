import { useEffect, useState } from 'react';
import { ActionIcon, Alert, Avatar, Badge, Button, Card, Group, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { IconArchive, IconArrowDown, IconArrowUp, IconPlus, IconSend, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { messageOf } from '../../api/client';
import { DetailSheet } from '../../components/DetailSheet';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/StateBlocks';
import { labelOf } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import { ProductPicker } from '../reels/tagging';
import { CollectionState, collectionKindLabel, COLLECTION_LIMITS, collectionStateColor, collectionStateLabel, profileApi, SLUG_PATTERN, type Collection } from './api';
import { collectionError } from './CollectionsPage';

function DetailsForm({ c }: { c: Collection }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(c.title);
  const [slug, setSlug] = useState(c.slug);
  const [subtitle, setSubtitle] = useState(c.subtitle ?? '');
  const [description, setDescription] = useState(c.description ?? '');
  const [cover, setCover] = useState(c.coverImageUrl ?? '');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [title, slug]);
  const save = useMutation({
    mutationFn: () =>
      profileApi.updateCollection(c.id, {
        title: title.trim(),
        slug: slug.trim(),
        subtitle: subtitle.trim() || null,
        description: description.trim() || null,
        coverImageUrl: cover.trim() || null,
        sortOrder: c.sortOrder,
      }),
    onSuccess: (next) => {
      toastSuccess('Saved');
      qc.setQueryData(['collections', c.id], next);
      void qc.invalidateQueries({ queryKey: ['collections', 'list'] });
    },
    onError: (e) => setError(collectionError(e)),
  });
  const submit = () => {
    if (!title.trim()) return setError('Give it a title.');
    if (!SLUG_PATTERN.test(slug.trim())) return setError('The address can use lowercase letters, numbers and single dashes.');
    if (cover.trim() && !/^https:\/\/\S+$/i.test(cover.trim())) return setError('The cover must be an https:// image link.');
    save.mutate();
  };
  const locked = c.state === CollectionState.Archived;
  return (
    <Stack gap="sm">
      {error && (
        <Alert color="signal" variant="light" role="alert">
          {error}
        </Alert>
      )}
      <TextInput label="Title" maxLength={COLLECTION_LIMITS.title} value={title} onChange={(e) => setTitle(e.currentTarget.value)} disabled={locked} />
      <TextInput label="Web address" maxLength={COLLECTION_LIMITS.slug} value={slug} onChange={(e) => setSlug(e.currentTarget.value.toLowerCase())} disabled={locked} />
      <TextInput label="Subtitle" maxLength={COLLECTION_LIMITS.subtitle} value={subtitle} onChange={(e) => setSubtitle(e.currentTarget.value)} disabled={locked} />
      <Textarea label="Description" autosize minRows={2} maxLength={COLLECTION_LIMITS.description} value={description} onChange={(e) => setDescription(e.currentTarget.value)} disabled={locked} />
      <TextInput label="Cover image link" placeholder="https://…" value={cover} onChange={(e) => setCover(e.currentTarget.value)} disabled={locked} />
      {!locked && (
        <Group>
          <Button onClick={submit} loading={save.isPending}>
            Save details
          </Button>
        </Group>
      )}
    </Stack>
  );
}

function Items({ c }: { c: Collection }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const update = (next: Collection) => {
    qc.setQueryData(['collections', c.id], next);
    void qc.invalidateQueries({ queryKey: ['collections', 'list'] });
  };
  const add = useMutation({
    mutationFn: (productId: string) => profileApi.addCollectionItem(c.id, productId, null),
    onSuccess: (next) => {
      toastSuccess('Added');
      setAdding(false);
      update(next);
    },
    onError: (e) => toastError(e, 'Could not add'),
  });
  const remove = useMutation({ mutationFn: (productId: string) => profileApi.removeCollectionItem(c.id, productId), onSuccess: update, onError: (e) => toastError(e) });
  const reorder = useMutation({ mutationFn: (ids: string[]) => profileApi.reorderCollection(c.id, ids), onSuccess: update, onError: (e) => toastError(e) });
  const items = [...c.items].sort((a, b) => a.sortOrder - b.sortOrder);
  const move = (i: number, d: -1 | 1) => {
    const ids = items.map((x) => x.productId);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorder.mutate(ids);
  };
  const locked = c.state === CollectionState.Archived;
  return (
    <Stack gap="sm">
      {items.length === 0 ? (
        <EmptyBlock title="No products yet" body="Add at least one product before you publish." />
      ) : (
        items.map((it, i) => (
          <Card key={it.productId} padding="xs" withBorder>
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                <Avatar src={it.primaryImageUrl ?? undefined} radius="sm" size={44} />
                <div style={{ minWidth: 0 }}>
                  <Text size="sm" fw={600} lineClamp={1}>
                    {it.productName}
                  </Text>
                  {!it.isPubliclyListed && (
                    <Text size="xs" c="var(--sm-warn-text)">
                      Not for sale right now — hidden from shoppers
                    </Text>
                  )}
                </div>
              </Group>
              {!locked && (
                <Group gap={2} wrap="nowrap">
                  <ActionIcon variant="subtle" color="gray" aria-label={`Move ${it.productName} up`} disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}>
                    <IconArrowUp size={16} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="gray" aria-label={`Move ${it.productName} down`} disabled={i === items.length - 1 || reorder.isPending} onClick={() => move(i, 1)}>
                    <IconArrowDown size={16} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="signal" aria-label={`Remove ${it.productName}`} onClick={() => remove.mutate(it.productId)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              )}
            </Group>
          </Card>
        ))
      )}
      {!locked && items.length < COLLECTION_LIMITS.maxItems && (
        <Group>
          <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => setAdding(true)}>
            Add product
          </Button>
        </Group>
      )}
      <DetailSheet opened={adding} onClose={() => setAdding(false)} title="Add a product">
        <ProductPicker onPick={(p) => add.mutate(p.productId)} />
        <Text size="xs" c="dimmed" mt="sm">
          Any product for sale on StyleMint can go in a collection — a partnership is only needed to earn commission on it.
        </Text>
      </DetailSheet>
    </Stack>
  );
}

export default function CollectionDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const c = useQuery({ queryKey: ['collections', id], queryFn: () => profileApi.collection(id) });
  const [error, setError] = useState<string | null>(null);
  const publish = useMutation({
    mutationFn: () => profileApi.publishCollection(id),
    onSuccess: (next) => {
      toastSuccess('Published on your storefront');
      qc.setQueryData(['collections', id], next);
      void qc.invalidateQueries({ queryKey: ['collections', 'list'] });
    },
    onError: (e) => setError(messageOf(e)),
  });
  const archive = useMutation({
    mutationFn: () => profileApi.archiveCollection(id),
    onSuccess: (next) => {
      toastSuccess('Archived');
      qc.setQueryData(['collections', id], next);
      void qc.invalidateQueries({ queryKey: ['collections', 'list'] });
    },
    onError: (e) => toastError(e),
  });
  if (c.isPending) return <LoadingBlock />;
  if (c.error)
    return (
      <>
        <PageHeader title="Collection" back={{ to: '/collections', label: 'Collections' }} />
        <ErrorBlock error={c.error} onRetry={() => void c.refetch()} title="Could not load this collection" />
      </>
    );
  const d = c.data;
  return (
    <>
      <PageHeader
        title={d.title}
        back={{ to: '/collections', label: 'Collections' }}
        meta={
          <Group gap="xs">
            <Badge variant="light" color={collectionStateColor[d.state] ?? 'gray'}>
              {labelOf(collectionStateLabel, d.state)}
            </Badge>
            <Text size="xs" c="dimmed">
              {labelOf(collectionKindLabel, d.kind)} · {d.items.length} products
            </Text>
          </Group>
        }
        actions={
          <>
            {d.state === CollectionState.Draft && (
              <Button leftSection={<IconSend size={16} />} loading={publish.isPending} onClick={() => publish.mutate()}>
                Publish
              </Button>
            )}
            {d.state !== CollectionState.Archived && (
              <Button
                variant="default"
                leftSection={<IconArchive size={16} />}
                loading={archive.isPending}
                onClick={() =>
                  void confirmAction({ title: 'Archive this collection?', body: 'It leaves your storefront for good and can no longer be edited.', confirmLabel: 'Archive', danger: true }).then(
                    (ok) => ok && archive.mutate(),
                  )
                }
              >
                Archive
              </Button>
            )}
          </>
        }
      />
      {error && (
        <Alert color="signal" variant="light" mb="md" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Stack gap="md">
        <SectionCard title="Products">
          <Items c={d} />
        </SectionCard>
        <SectionCard title="Details">
          <DetailsForm key={d.id} c={d} />
        </SectionCard>
      </Stack>
    </>
  );
}
