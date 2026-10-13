import { Avatar, Badge, Button, Card, Group, Stack, Tabs, Text } from '@mantine/core';
import { IconBuildingStore, IconCheck, IconX } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useCursorList } from '../../api/useCursorList';
import { DataList } from '../../components/DataList';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDate, initialsOf, labelOf } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import { useTab } from '../../lib/useTab';
import { commissionRange, partnershipsApi, partnershipStateColor, partnershipStateLabel, pendingActor, type Partnership } from './api';

export function BrandCell({ p }: { p: Pick<Partnership, 'vendorName' | 'vendorLogoUrl'> }) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Avatar src={p.vendorLogoUrl ?? undefined} radius="md" size={36} color="forest">
        {initialsOf(p.vendorName)}
      </Avatar>
      <Text size="sm" fw={600} lineClamp={1}>
        {p.vendorName ?? 'Brand'}
      </Text>
    </Group>
  );
}

/** Accept / decline an invite the brand sent. */
export function InviteActions({ p, compact }: { p: Partnership; compact?: boolean }) {
  const qc = useQueryClient();
  const done = (msg: string) => {
    toastSuccess(msg);
    void qc.invalidateQueries({ queryKey: ['partnerships'] });
    void qc.invalidateQueries({ queryKey: ['home'] });
  };
  const accept = useMutation({
    mutationFn: () => partnershipsApi.accept(p.id),
    onSuccess: () => done(`You’re now partnered with ${p.vendorName ?? 'the brand'}. You can tag their products.`),
    onError: (e) => toastError(e, 'Could not accept'),
  });
  const decline = useMutation({
    mutationFn: () => partnershipsApi.decline(p.id),
    onSuccess: () => done('Invite declined'),
    onError: (e) => toastError(e, 'Could not decline'),
  });
  if (pendingActor(p) !== 'creator') return null;
  return (
    <Group gap="xs" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
      <Button size={compact ? 'xs' : 'sm'} leftSection={<IconCheck size={14} />} loading={accept.isPending} onClick={() => accept.mutate()}>
        Accept
      </Button>
      <Button
        size={compact ? 'xs' : 'sm'}
        variant="default"
        leftSection={<IconX size={14} />}
        loading={decline.isPending}
        onClick={() =>
          void confirmAction({
            title: `Decline ${p.vendorName ?? 'this brand'}’s invite?`,
            body: 'Declining is final: you cannot partner with this brand again later.',
            confirmLabel: 'Decline',
            danger: true,
          }).then((ok) => ok && decline.mutate())
        }
      >
        Decline
      </Button>
    </Group>
  );
}

const TAB_STATES: Record<string, number[] | null> = {
  invites: [1],
  active: [3, 4],
  past: [2, 5],
  all: null,
};

function PartnershipList({ tab }: { tab: string }) {
  const navigate = useNavigate();
  const list = useCursorList({ key: ['partnerships', 'list', tab], fetchPage: (c) => partnershipsApi.list(TAB_STATES[tab] ?? null, c) });
  if (list.query.isPending) return <ListSkeleton rows={4} />;
  if (list.query.error) return <ErrorBlock error={list.query.error} onRetry={() => void list.query.refetch()} title="Could not load your partnerships" />;
  const items = list.query.data?.items ?? [];
  if (items.length === 0)
    return (
      <EmptyBlock
        title={tab === 'invites' ? 'No invites or requests waiting' : tab === 'active' ? 'No active partnerships yet' : 'Nothing here yet'}
        body="Partner with brands to tag their products in your reels and earn commission on every sale."
        action={
          <Button component={Link} to="/brands" mt="sm" leftSection={<IconBuildingStore size={16} />}>
            Find brands
          </Button>
        }
      />
    );
  return (
    <>
      <DataList<Partnership>
        items={items}
        rowKey={(p) => p.id}
        caption="Partnerships"
        testId="partnerships-list"
        onOpen={(p) => navigate(`/partnerships/${p.id}`)}
        cardTitle={(p) => <BrandCell p={p} />}
        cardRight={(p) => (
          <Badge variant="light" color={partnershipStateColor[p.state] ?? 'gray'}>
            {labelOf(partnershipStateLabel, p.state)}
          </Badge>
        )}
        columns={[
          { key: 'brand', header: 'Brand', hideOnCard: true, render: (p) => <BrandCell p={p} /> },
          { key: 'commission', header: 'Commission', render: (p) => commissionRange(p.commissionMinPercent, p.commissionMaxPercent) },
          {
            key: 'kind',
            header: 'Started by',
            render: (p) => (p.initiatedByCreator ? 'You (request)' : p.brandBriefId ? 'Brand (campaign)' : 'Brand (invite)'),
          },
          { key: 'date', header: 'Since', render: (p) => formatDate(p.respondedUtc ?? p.invitedUtc) },
          {
            key: 'state',
            header: 'Status',
            hideOnCard: true,
            render: (p) => (
              <Stack gap={2}>
                <Badge variant="light" color={partnershipStateColor[p.state] ?? 'gray'}>
                  {labelOf(partnershipStateLabel, p.state)}
                </Badge>
                {pendingActor(p) === 'brand' && (
                  <Text size="xs" c="dimmed">
                    Waiting for the brand
                  </Text>
                )}
              </Stack>
            ),
          },
          { key: 'actions', header: '', render: (p) => <InviteActions p={p} compact /> },
        ]}
      />
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} shown={items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} busy={list.query.isFetching} />
    </>
  );
}

export default function PartnershipsPage() {
  const [tab, setTab] = useTab(['invites', 'active', 'past', 'all'] as const, 'active');
  return (
    <>
      <PageHeader
        title="Partnerships"
        description="Brands you work with. An active partnership lets you tag the brand’s products and earn its commission."
        actions={
          <Button component={Link} to="/brands" variant="light" leftSection={<IconBuildingStore size={16} />}>
            Find brands
          </Button>
        }
      />
      <Card>
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List mb="md">
            <Tabs.Tab value="active">Active</Tabs.Tab>
            <Tabs.Tab value="invites">Invites & requests</Tabs.Tab>
            <Tabs.Tab value="past">Past</Tabs.Tab>
            <Tabs.Tab value="all">All</Tabs.Tab>
          </Tabs.List>
          <PartnershipList key={tab} tab={tab} />
        </Tabs>
      </Card>
    </>
  );
}
