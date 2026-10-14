import { useState } from 'react';
import { Alert, Badge, Box, Button, Card, Group, Image, Modal, SegmentedControl, SimpleGrid, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { IconLayoutGrid, IconPlus } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, messageOf } from '../../api/client';
import { useCursorList } from '../../api/useCursorList';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDate, labelOf } from '../../lib/format';
import { toastSuccess } from '../../lib/notify';
import { CollectionKind, collectionKindLabel, COLLECTION_LIMITS, collectionStateColor, collectionStateLabel, profileApi, slugify, SLUG_PATTERN } from './api';

export function collectionError(e: unknown): string {
  if (e instanceof ApiError && e.code === 'state.duplicate') return 'That web address is taken. Change the address and try again.';
  return messageOf(e);
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [kind, setKind] = useState<string>(String(CollectionKind.CreatorCollection));
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const effectiveSlug = slugTouched ? slug : slugify(title);
  const create = useMutation({
    mutationFn: () =>
      profileApi.createCollection(Number(kind), {
        title: title.trim(),
        slug: effectiveSlug,
        subtitle: subtitle.trim() || null,
        description: description.trim() || null,
        sortOrder: 0,
      }),
    onSuccess: (c) => {
      toastSuccess('Created. Now add products.');
      void qc.invalidateQueries({ queryKey: ['collections'] });
      navigate(`/collections/${c.id}`);
    },
    onError: (e) => setError(collectionError(e)),
  });
  const submit = () => {
    setError(null);
    if (!title.trim()) return setError('Give it a title.');
    if (!SLUG_PATTERN.test(effectiveSlug)) return setError('The address can use lowercase letters, numbers and single dashes.');
    create.mutate();
  };
  return (
    <Modal opened onClose={onClose} title="New collection or look">
      <Stack gap="sm">
        {error && (
          <Alert color="signal" variant="light" role="alert">
            {error}
          </Alert>
        )}
        <SegmentedControl
          value={kind}
          onChange={setKind}
          data={[
            { value: String(CollectionKind.CreatorCollection), label: 'Collection' },
            { value: String(CollectionKind.Look), label: 'Look' },
          ]}
        />
        <Text size="xs" c="dimmed">
          {Number(kind) === CollectionKind.Look ? 'A look is one outfit: products pinned on a cover photo.' : 'A collection is a list of products you recommend.'}
        </Text>
        <TextInput label="Title" maxLength={COLLECTION_LIMITS.title} value={title} onChange={(e) => setTitle(e.currentTarget.value)} required />
        <TextInput
          label="Web address"
          description="Lowercase letters, numbers and dashes"
          maxLength={COLLECTION_LIMITS.slug}
          value={effectiveSlug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.currentTarget.value.toLowerCase());
          }}
        />
        <TextInput label="Subtitle" maxLength={COLLECTION_LIMITS.subtitle} value={subtitle} onChange={(e) => setSubtitle(e.currentTarget.value)} />
        <Textarea label="Description" autosize minRows={2} maxLength={COLLECTION_LIMITS.description} value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default function CollectionsPage() {
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const state = filter === 'all' ? undefined : Number(filter);
  const list = useCursorList({ key: ['collections', 'list'], resetKey: filter, fetchPage: (c) => profileApi.collections(c, state) });
  const items = list.query.data?.items ?? [];
  return (
    <>
      <PageHeader
        title="Collections & looks"
        description="Curate products on your storefront — your favourites, or a full outfit."
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
            New
          </Button>
        }
      />
      <SegmentedControl
        mb="md"
        value={filter}
        onChange={setFilter}
        data={[
          { value: 'all', label: 'All' },
          { value: '1', label: 'Drafts' },
          { value: '2', label: 'Published' },
          { value: '3', label: 'Archived' },
        ]}
      />
      {list.query.isPending ? (
        <ListSkeleton rows={2} height={140} />
      ) : list.query.error ? (
        <ErrorBlock error={list.query.error} onRetry={() => void list.query.refetch()} title="Could not load your collections" />
      ) : items.length === 0 ? (
        <Card>
          <EmptyBlock
            title={filter === 'all' ? 'No collections yet' : 'Nothing in this filter'}
            body="Group products you love so shoppers can buy them in one place."
            action={
              <Button mt="sm" leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
                Create one
              </Button>
            }
          />
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 4 }} spacing="md">
          {items.map((c) => (
            <Card key={c.id} padding={0} component={Link} to={`/collections/${c.id}`} data-interactive="true" style={{ textDecoration: 'none', color: 'inherit', overflow: 'hidden' }}>
              <Box h={120} style={{ background: 'var(--sm-inset)' }}>
                {c.coverImageUrl ? (
                  <Image src={c.coverImageUrl} alt="" h={120} fit="cover" />
                ) : (
                  <Stack h="100%" align="center" justify="center">
                    <IconLayoutGrid size={28} opacity={0.4} aria-hidden />
                  </Stack>
                )}
              </Box>
              <Stack gap={4} p="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Text fw={600} size="sm" lineClamp={1}>
                    {c.title}
                  </Text>
                  <Badge size="sm" variant="light" color={collectionStateColor[c.state] ?? 'gray'}>
                    {labelOf(collectionStateLabel, c.state)}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  {labelOf(collectionKindLabel, c.kind)} · {c.itemCount} products · updated {formatDate(c.updatedUtc)}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} shown={items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} busy={list.query.isFetching} />
      {creating && <CreateModal onClose={() => setCreating(false)} />}
    </>
  );
}
