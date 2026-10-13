import { useState } from 'react';
import {
  Alert,
  Anchor,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Image,
  RangeSlider,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  Textarea,
} from '@mantine/core';
import { IconRosetteDiscountCheck, IconSend, IconSparkles, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, messageOf } from '../../api/client';
import { useCursorList } from '../../api/useCursorList';
import { DetailSheet } from '../../components/DetailSheet';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { initialsOf } from '../../lib/format';
import { toastError, toastSuccess } from '../../lib/notify';
import { commissionRange, partnershipsApi, type Brand, type Match } from './api';

/** How responsive the brand has been to creators (measured, with the server's own wording). */
export function BrandRecordCard({ vendorProfileId }: { vendorProfileId: string }) {
  const rec = useQuery({ queryKey: ['partnerships', 'brand-record', vendorProfileId], queryFn: () => partnershipsApi.brandRecord(vendorProfileId) });
  return (
    <SectionCard title="Track record with creators" description={rec.data ? `Last ${rec.data.windowDays} days` : undefined}>
      {rec.isPending ? (
        <ListSkeleton rows={2} height={24} />
      ) : rec.error ? (
        <ErrorBlock error={rec.error} onRetry={() => void rec.refetch()} title="Could not load the brand’s record" />
      ) : (
        <Stack gap={6}>
          <Text size="sm">
            {rec.data.counts.activeNow} active partnerships now · {rec.data.counts.partnershipsAllTime} in total
          </Text>
          <Text size="sm" c="dimmed">
            {rec.data.creatorRequestsAnswered?.statement ?? 'Not enough creator requests yet to measure how quickly they answer.'}
          </Text>
          {rec.data.messagingRecordAvailable && rec.data.creatorChatsReplied && (
            <Text size="sm" c="dimmed">
              {rec.data.creatorChatsReplied.statement}
            </Text>
          )}
        </Stack>
      )}
    </SectionCard>
  );
}

function requestError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'state.conflict') return 'You already have — or had — a partnership with this brand, so a new request is not possible.';
    if (e.code === 'rule.violation' && /terms/i.test(e.message)) return 'This brand has not published its partnership terms yet, so it cannot take requests.';
  }
  return messageOf(e);
}

/** Ask a brand to partner: commission range inside the brand's own range, a short pitch, niches, sample reels. */
export function RequestPartnershipForm({ brand, initialRange, onDone }: { brand: Brand; initialRange?: [number, number]; onDone: () => void }) {
  const qc = useQueryClient();
  const lo = Math.round((brand.commissionRangeMin ?? 0.05) * 100);
  const hi = Math.max(lo, Math.round((brand.commissionRangeMax ?? 0.3) * 100));
  const [range, setRange] = useState<[number, number]>(initialRange ?? [lo, hi]);
  const [message, setMessage] = useState('');
  const [niches, setNiches] = useState<string[]>([]);
  const [samples, setSamples] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: () =>
      partnershipsApi.request({
        vendorProfileId: brand.id,
        commissionMinPercent: range[0] / 100,
        commissionMaxPercent: range[1] / 100,
        ...(message.trim() ? { message: message.trim() } : {}),
        ...(niches.length ? { niches } : {}),
        ...(samples.length ? { sampleReelUrls: samples } : {}),
      }),
    onSuccess: () => {
      toastSuccess(`Request sent to ${brand.businessName}`);
      void qc.invalidateQueries({ queryKey: ['partnerships'] });
      onDone();
    },
    onError: (e) => setError(requestError(e)),
  });
  const submit = () => {
    setError(null);
    if (samples.some((s) => !/^https?:\/\/\S+$/i.test(s))) return setError('Sample reels must be links starting with https://');
    send.mutate();
  };
  return (
    <Stack gap="md" data-testid="request-form">
      {error && (
        <Alert color="signal" variant="light" role="alert">
          {error}
        </Alert>
      )}
      <div>
        <Text size="sm" fw={600}>
          Commission you’re asking for: {range[0] === range[1] ? `${range[0]}%` : `${range[0]}–${range[1]}%`}
        </Text>
        <Text size="xs" c="dimmed" mb="lg">
          {brand.businessName} offers {commissionRange(brand.commissionRangeMin, brand.commissionRangeMax)}.
        </Text>
        <Box px={6} pb="md">
          <RangeSlider
            min={0}
            max={100}
            step={1}
            minRange={0}
            value={range}
            onChange={setRange}
            label={(v) => `${v}%`}
            marks={[
              { value: lo, label: `${lo}%` },
              { value: hi, label: `${hi}%` },
            ]}
            thumbFromLabel="Lowest commission"
            thumbToLabel="Highest commission"
          />
        </Box>
      </div>
      <Textarea
        label="Why you’re a good fit"
        placeholder="Tell the brand about your audience and how you would feature their products."
        maxLength={500}
        autosize
        minRows={3}
        value={message}
        onChange={(e) => setMessage(e.currentTarget.value)}
        description={`${message.length}/500`}
      />
      <TagsInput label="Your niches" description="Up to 5, e.g. ethnic wear, streetwear" maxTags={5} value={niches} onChange={(v) => setNiches(v.map((x) => x.slice(0, 60)))} />
      <TagsInput label="Sample reels" description="Up to 10 links to reels you’re proud of" maxTags={10} value={samples} onChange={setSamples} />
      <Group justify="flex-end">
        <Button leftSection={<IconSend size={16} />} loading={send.isPending} onClick={submit}>
          Send request
        </Button>
      </Group>
    </Stack>
  );
}

function BrandSheet({ brand, onClose, initialRange }: { brand: Brand; onClose: () => void; initialRange?: [number, number] }) {
  const [requesting, setRequesting] = useState(!!initialRange);
  return (
    <DetailSheet opened onClose={onClose} title={brand.businessName}>
      <Stack gap="md">
        {brand.coverImageUrl && <Image src={brand.coverImageUrl} alt="" radius="md" h={120} fit="cover" />}
        <Group gap="sm" wrap="nowrap">
          <Avatar src={brand.logoUrl ?? undefined} size={52} radius="md" color="forest">
            {initialsOf(brand.businessName)}
          </Avatar>
          <div>
            <Group gap={6}>
              <Text fw={650}>{brand.businessName}</Text>
              {brand.isVerified && <IconRosetteDiscountCheck size={18} color="var(--sm-accent)" aria-label="Verified brand" />}
            </Group>
            <Text size="sm" c="dimmed">
              {brand.tagline ?? brand.originCity ?? ''}
            </Text>
          </div>
        </Group>
        <Badge variant="light" color="forest" size="lg" w="fit-content">
          Commission {commissionRange(brand.commissionRangeMin, brand.commissionRangeMax)}
        </Badge>
        {(brand.description || brand.brandStory) && (
          <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
            {brand.description ?? brand.brandStory}
          </Text>
        )}
        {brand.websiteUrl && /^https?:\/\//i.test(brand.websiteUrl) && (
          <Anchor href={brand.websiteUrl} target="_blank" rel="noopener noreferrer" size="sm">
            {brand.websiteUrl.replace(/^https?:\/\//, '')}
          </Anchor>
        )}
        <BrandRecordCard vendorProfileId={brand.id} />
        {requesting ? (
          <SectionCard title="Ask to partner">
            <RequestPartnershipForm brand={brand} initialRange={initialRange} onDone={onClose} />
          </SectionCard>
        ) : (
          <Button onClick={() => setRequesting(true)} leftSection={<IconSend size={16} />}>
            Ask to partner
          </Button>
        )}
      </Stack>
    </DetailSheet>
  );
}

function BrandTile({ brand, onOpen }: { brand: Brand; onOpen: () => void }) {
  return (
    <Card padding="md" data-interactive="true" onClick={onOpen} style={{ cursor: 'pointer' }} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()} aria-label={`Open ${brand.businessName}`}>
      <Group gap="sm" wrap="nowrap">
        <Avatar src={brand.logoUrl ?? undefined} size={44} radius="md" color="forest">
          {initialsOf(brand.businessName)}
        </Avatar>
        <div style={{ minWidth: 0 }}>
          <Text fw={600} size="sm" truncate>
            {brand.businessName}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {brand.tagline ?? brand.originCity ?? ' '}
          </Text>
        </div>
      </Group>
      <Text size="xs" mt="sm" c="var(--sm-good-text)" fw={600}>
        {commissionRange(brand.commissionRangeMin, brand.commissionRangeMax)} commission
      </Text>
    </Card>
  );
}

function MatchesSection({ onOpen }: { onOpen: (b: Brand, range?: [number, number]) => void }) {
  const qc = useQueryClient();
  const matches = useQuery({ queryKey: ['partnerships', 'matches'], queryFn: () => partnershipsApi.matches(null) });
  const dismiss = useMutation({
    mutationFn: (m: Match) => partnershipsApi.dismissMatch(m.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['partnerships', 'matches'] }),
    onError: (e) => toastError(e),
  });
  const propose = useMutation({
    mutationFn: async (m: Match) => {
      const prefill = await partnershipsApi.proposeMatch(m.id);
      const brand = await partnershipsApi.brand(m.vendorAccountId);
      const range: [number, number] | undefined =
        prefill.brandCommissionMaxBps > 0 ? [Math.round(prefill.brandCommissionMinBps / 100), Math.round(prefill.brandCommissionMaxBps / 100)] : undefined;
      return { brand, range };
    },
    onSuccess: ({ brand, range }) => onOpen(brand, range),
    onError: (e) => toastError(e, 'Could not open this match'),
  });
  if (matches.isPending) return <ListSkeleton rows={2} height={64} />;
  if (matches.error) return <ErrorBlock error={matches.error} onRetry={() => void matches.refetch()} title="Could not load your matches" />;
  if (matches.data.items.length === 0) return <Text size="sm" c="dimmed">No new matches today. StyleMint suggests brands every day based on your reels and audience.</Text>;
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
      {matches.data.items.map((m) => (
        <Card key={m.id} padding="md">
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <Group gap="sm" wrap="nowrap">
              <Avatar src={m.vendorAvatarUrl ?? undefined} radius="md" color="forest">
                {initialsOf(m.vendorDisplayName)}
              </Avatar>
              <div>
                <Text fw={600} size="sm">
                  {m.vendorDisplayName ?? 'A brand'}
                </Text>
                <Badge size="xs" variant="light" color="forest">
                  {Math.round(m.score * 100)}% match
                </Badge>
              </div>
            </Group>
            <Button variant="subtle" color="gray" size="compact-xs" onClick={() => dismiss.mutate(m)} aria-label={`Dismiss ${m.vendorDisplayName ?? 'match'}`}>
              <IconX size={14} />
            </Button>
          </Group>
          <Text size="xs" c="dimmed" mt="xs" lineClamp={3}>
            {m.reasonSummary}
          </Text>
          <Button mt="sm" size="xs" variant="light" loading={propose.isPending && propose.variables?.id === m.id} onClick={() => propose.mutate(m)}>
            See brand
          </Button>
        </Card>
      ))}
    </SimpleGrid>
  );
}

export default function BrandsPage() {
  const [open, setOpen] = useState<{ brand: Brand; range?: [number, number] } | null>(null);
  const list = useCursorList({ key: ['partnerships', 'brands'], fetchPage: partnershipsApi.brands });
  const items = list.query.data?.items ?? [];
  return (
    <>
      <PageHeader title="Find brands" description="Brands on StyleMint that work with creators. Ask to partner, then tag their products in your reels." />
      <Stack gap="md">
        <SectionCard title="Matched for you" description="Daily suggestions from StyleMint" action={<IconSparkles size={18} color="var(--sm-accent)" />}>
          <MatchesSection onOpen={(brand, range) => setOpen({ brand, range })} />
        </SectionCard>
        <SectionCard title="All brands">
          {list.query.isPending ? (
            <ListSkeleton rows={3} height={72} />
          ) : list.query.error ? (
            <ErrorBlock error={list.query.error} onRetry={() => void list.query.refetch()} title="Could not load brands" />
          ) : items.length === 0 ? (
            <EmptyBlock title="No brands yet" />
          ) : (
            <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 4 }} spacing="sm" data-testid="brands-grid">
              {items.map((b) => (
                <BrandTile key={b.id} brand={b} onOpen={() => setOpen({ brand: b })} />
              ))}
            </SimpleGrid>
          )}
          <Pager page={list.page} pageSize={list.pageSize} total={list.total} shown={items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} busy={list.query.isFetching} />
        </SectionCard>
      </Stack>
      {open && <BrandSheet brand={open.brand} initialRange={open.range} onClose={() => setOpen(null)} />}
    </>
  );
}
