import { Badge, Box, Button, Group, Image, Select, Skeleton, Stack, Table, Text, TextInput } from '@mantine/core';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconMovie, IconPlayerStop, IconSearch, IconX } from '@tabler/icons-react';
import { ApiError } from '@/api/errors';
import {
  ENDED_BY,
  HIDDEN_REASON,
  JOURNEY_ENDED,
  JOURNEY_STATE,
  journeysAdminApi,
  journeyTitle,
  STEP_STATE,
  STEP_STATE_TONE,
  validEndReason,
  type AdminJourney,
  type AdminJourneyStep,
} from '@/api/journeys';
import { useAuth } from '@/auth/guards';
import { useActionDialog } from '@/components/ActionDialog';
import { FieldGrid, IdText, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { PageHeader } from '@/components/PageHeader';
import { ErrorBlock, NotAvailableBlock, SectionCard } from '@/components/StateBlocks';
import { useListState } from '@/hooks/useListState';
import { fmtDate } from '@/lib/format';

const STATE_OPTIONS = Object.entries(JOURNEY_STATE).map(([value, label]) => ({ value, label }));

const isMissing = (e: unknown) => e instanceof ApiError && e.isMissingEndpoint;

export function JourneyStateBadge({ j }: { j: Pick<AdminJourney, 'state' | 'isLive'> }) {
  if (j.state === JOURNEY_ENDED)
    return (
      <Badge variant="light" color="gray" size="sm">
        Ended
      </Badge>
    );
  return (
    <Badge variant="light" color={j.isLive ? 'forest' : 'amber'} size="sm">
      {j.isLive ? 'Live' : 'Active · not live'}
    </Badge>
  );
}

function Thumb({ url }: { url: string | null }) {
  return url ? (
    <Image src={url} alt="" w={36} h={64} radius="sm" fit="cover" />
  ) : (
    <Box w={36} h={64} aria-hidden style={{ borderRadius: 6, display: 'grid', placeItems: 'center', background: 'var(--sm-surface-2, var(--mantine-color-gray-1))' }}>
      <IconMovie size={16} opacity={0.5} />
    </Box>
  );
}

/**
 * Journeys across every vendor (journey-reels-contract v1 §5): find one by title, city, business name or id; look at
 * its steps and members; end it with a reason when it breaks the rules. Ending is moderation: it cannot be undone and
 * every business in the journey is told.
 */
export function JourneysPage() {
  const list = useListState(['state', 'vendor'] as const);
  const query = useQuery({
    queryKey: ['journeys', 'list', list.search, list.filters.state, list.filters.vendor, list.page, list.pageSize],
    queryFn: ({ signal }) =>
      journeysAdminApi.list({ q: list.search, state: list.filters.state, vendorAccountId: list.filters.vendor, page: list.page, pageSize: list.pageSize }, signal),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const header = (
    <PageHeader title="Journeys" description="Reels from different businesses linked in order — buyers swipe right through each step. Shows in the feed with at least 2 visible steps." />
  );
  if (isMissing(query.error))
    return (
      <>
        {header}
        <NotAvailableBlock what="Journeys" detail="The journey reels feature is not deployed on this server yet. Journeys will appear here once it is." />
      </>
    );

  const columns: Column<AdminJourney>[] = [
    { key: 'title', header: 'Journey', render: (j) => <TwoLine primary={journeyTitle(j)} secondary={j.city ?? undefined} /> },
    { key: 'owner', header: 'Owner', render: (j) => j.ownerName },
    { key: 'steps', header: 'Steps', align: 'right', visibleFrom: 'sm', render: (j) => `${j.visibleStepCount} visible / ${j.steps.length}` },
    { key: 'members', header: 'Businesses', align: 'right', visibleFrom: 'md', render: (j) => j.memberCount ?? j.steps.length },
    { key: 'state', header: 'Status', render: (j) => <JourneyStateBadge j={j} /> },
    { key: 'updated', header: 'Updated', visibleFrom: 'lg', render: (j) => fmtDate(j.updatedUtc) },
  ];

  return (
    <>
      {header}
      <DataTable
        label="Journeys"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(j) => j.id}
        onRowClick={(j) => list.open(j.id)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        filtered={list.filtered}
        emptyTitle="No journeys yet"
        emptyBody="Journeys appear here as soon as businesses link their reels together."
        toolbar={
          <Group gap="md" align="flex-end" wrap="wrap">
            <TextInput
              label="Search"
              placeholder="Title, city, business or journey ID"
              leftSection={<IconSearch size={14} />}
              w={280}
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.currentTarget.value)}
            />
            <Select label="Status" w={170} clearable placeholder="Any" data={STATE_OPTIONS} value={list.filters.state || null} onChange={(v) => list.setFilter('state', v)} />
            <TextInput
              label="Vendor account ID"
              placeholder="Paste a vendor ID"
              w={300}
              value={list.filters.vendor}
              onChange={(e) => list.setFilter('vendor', e.currentTarget.value.trim() || null)}
              rightSection={list.filters.vendor ? <IconX size={14} style={{ cursor: 'pointer' }} aria-label="Clear vendor" onClick={() => list.setFilter('vendor', null)} /> : undefined}
            />
          </Group>
        }
      />
      <JourneyDrawer id={list.selected} onClose={() => list.open(null)} />
    </>
  );
}

function StepRow({ s, position }: { s: AdminJourneyStep; position: number | null }) {
  return (
    <Table.Tr data-testid={`step-${s.id}`}>
      <Table.Td>{position ?? '—'}</Table.Td>
      <Table.Td>
        <Thumb url={s.thumbnailUrl} />
      </Table.Td>
      <Table.Td>
        <TwoLine primary={s.vendorName} secondary={s.caption ?? (s.inviteNote ? `Invite note: ${s.inviteNote}` : undefined)} />
        <IdText value={s.vendorAccountId} />
      </Table.Td>
      <Table.Td>
        <Stack gap={4}>
          <Badge variant="light" size="sm" color={STEP_STATE_TONE[s.state] ?? 'gray'}>
            {STEP_STATE[s.state] ?? `State ${s.state}`}
          </Badge>
          {(s.state === 1 || s.state === 2) && !s.isVisible && (
            <Text size="xs" c="dimmed">
              {HIDDEN_REASON[s.hiddenReason] ?? 'Hidden'}
            </Text>
          )}
        </Stack>
      </Table.Td>
      <Table.Td>
        <Stack gap={0}>
          {s.reelId ? <IdText value={s.reelId} /> : <Text size="xs" c="dimmed">No reel yet</Text>}
          {s.closedUtc && (
            <Text size="xs" c="dimmed">
              Closed <When value={s.closedUtc} />
            </Text>
          )}
        </Stack>
      </Table.Td>
    </Table.Tr>
  );
}

function JourneyDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const q = useQuery({ queryKey: ['journeys', 'detail', id], queryFn: ({ signal }) => journeysAdminApi.get(id!, signal), enabled: !!id });
  const j = q.data;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['journeys'] });
  const steps = j ? (j.allSteps && j.allSteps.length > 0 ? j.allSteps : j.steps) : [];
  const openIds = new Set(j?.steps.map((s) => s.id) ?? []);
  const members = j ? Array.from(new Map(j.steps.map((s) => [s.vendorAccountId, s])).values()) : [];

  return (
    <DetailDrawer
      opened={!!id}
      onClose={onClose}
      title={j ? journeyTitle(j) : 'Journey'}
      subtitle={j ? [j.city, `Owner: ${j.ownerName}`].filter(Boolean).join(' · ') : undefined}
      badges={j && <JourneyStateBadge j={j} />}
      actions={
        j &&
        can('decideModeration') &&
        j.state !== JOURNEY_ENDED && (
          <Button
            size="sm"
            variant="light"
            color="signal"
            leftSection={<IconPlayerStop size={16} />}
            onClick={() =>
              open({
                title: `End “${journeyTitle(j)}”`,
                consequence: `The journey disappears from the feed for good and all ${j.memberCount ?? j.steps.length} businesses in it are told, with your reason. Their reels stay published on their own. This cannot be undone.`,
                confirmLabel: 'End journey',
                danger: true,
                fields: [{ name: 'reason', kind: 'textarea', label: 'Reason (shown to the businesses, kept in the audit log)', required: true, minLength: 3 }],
                run: (f) => {
                  const reason = (f.reason ?? '').trim();
                  if (!validEndReason(reason)) return Promise.reject(new Error('Give a reason of 3 to 500 characters.'));
                  return journeysAdminApi.end(j.id, reason);
                },
                success: 'Journey ended.',
                onDone: refresh,
              })
            }
          >
            End journey…
          </Button>
        )
      }
    >
      {dialog}
      {q.error ? (
        <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />
      ) : !j ? (
        <Stack>
          <Skeleton height={120} radius="lg" />
          <Skeleton height={200} radius="lg" />
        </Stack>
      ) : (
        <Stack gap="lg">
          <SectionCard title="Journey">
            <FieldGrid
              fields={[
                { label: 'Status', value: JOURNEY_STATE[j.state] ?? `State ${j.state}` },
                { label: 'In the feed', value: j.isLive ? 'Yes' : 'No' },
                { label: 'Visible steps', value: `${j.visibleStepCount} of ${j.steps.length} open (max ${j.maxSteps})` },
                { label: 'Owner', value: <TwoLine primary={j.ownerName} secondary={<IdText value={j.ownerVendorAccountId} />} /> },
                { label: 'Journey ID', value: <IdText value={j.id} /> },
                { label: 'Created', value: <When value={j.createdUtc} /> },
                { label: 'Updated', value: <When value={j.updatedUtc} /> },
                { label: 'Ended', value: j.endedUtc ? <When value={j.endedUtc} /> : null },
                { label: 'Ended by', value: j.endedBy ? ENDED_BY[j.endedBy] : null },
                { label: 'End reason', value: j.endReason, wide: true },
              ]}
            />
          </SectionCard>
          <SectionCard title={`Members (${members.length})`}>
            <Stack gap={4}>
              {members.map((m) => (
                <Group key={m.vendorAccountId} justify="space-between" wrap="nowrap">
                  <Text size="sm">
                    {m.vendorName}
                    {m.vendorAccountId === j.ownerVendorAccountId ? ' (owner)' : ''}
                  </Text>
                  <IdText value={m.vendorAccountId} />
                </Group>
              ))}
            </Stack>
          </SectionCard>
          <SectionCard title="Steps" description="Open steps in the owner's order, then every step that was left, removed or declined.">
            <Table aria-label="Journey steps" verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Reel</Table.Th>
                  <Table.Th>Business</Table.Th>
                  <Table.Th>Step</Table.Th>
                  <Table.Th>Reel ID</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {steps.map((s) => (
                  <StepRow key={s.id} s={s} position={openIds.has(s.id) ? j.steps.findIndex((o) => o.id === s.id) + 1 : null} />
                ))}
              </Table.Tbody>
            </Table>
          </SectionCard>
          {!can('decideModeration') && (
            <Text size="sm" c="dimmed">
              Your role can look at journeys but not end them.
            </Text>
          )}
        </Stack>
      )}
    </DetailDrawer>
  );
}
