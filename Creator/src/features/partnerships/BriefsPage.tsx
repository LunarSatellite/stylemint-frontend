import { Avatar, Badge, Button, Card, Group, SimpleGrid, Stack, Tabs, Text } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useCursorList } from '../../api/useCursorList';
import { DataList } from '../../components/DataList';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatCompact, formatDate, fromNow, initialsOf, labelOf } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import { useTab } from '../../lib/useTab';
import {
  ApplicationState,
  applicationStateColor,
  applicationStateLabel,
  campaignGoalLabel,
  commissionRange,
  partnershipsApi,
  type Brief,
  type CampaignApplication,
} from './api';
import { useBrandLookup } from './useBrandNames';

export function BriefCard({ brief }: { brief: Brief }) {
  const brand = useBrandLookup()(brief.vendorProfileId);
  return (
    <Card padding="md" data-interactive="true" component={Link} to={`/briefs/${brief.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <Group gap="sm" wrap="nowrap" mb="xs">
        <Avatar src={brand?.logoUrl ?? undefined} radius="md" size={36} color="forest">
          {initialsOf(brand?.businessName ?? 'B')}
        </Avatar>
        <div style={{ minWidth: 0 }}>
          <Text size="xs" c="dimmed" truncate>
            {brand?.businessName ?? 'A brand'}
          </Text>
          <Text fw={650} size="sm" lineClamp={2}>
            {brief.title}
          </Text>
        </div>
      </Group>
      <Group gap={6} mb="xs">
        <Badge variant="light" color="forest">
          {commissionRange(brief.commissionRange.minPercent, brief.commissionRange.maxPercent)} commission
        </Badge>
        <Badge variant="light" color="gray">
          {labelOf(campaignGoalLabel, brief.primaryGoal)}
        </Badge>
      </Group>
      <Text size="xs" c="dimmed">
        {brief.body.suggestedCadence.reelsPerWeek > 0 ? `${brief.body.suggestedCadence.reelsPerWeek} reels a week · ` : ''}
        reach {formatCompact(brief.roiProjection.estimatedReachLow)}–{formatCompact(brief.roiProjection.estimatedReachHigh)}
      </Text>
      {brief.applicationsCloseUtc && (
        <Group gap={4} mt={6} c="var(--sm-warn-text)">
          <IconClock size={14} aria-hidden />
          <Text size="xs" fw={600}>
            Applications close {fromNow(brief.applicationsCloseUtc)}
          </Text>
        </Group>
      )}
    </Card>
  );
}

function OpenBriefs() {
  const list = useCursorList({ key: ['partnerships', 'briefs'], fetchPage: partnershipsApi.briefs });
  if (list.query.isPending) return <ListSkeleton rows={3} height={96} />;
  if (list.query.error) return <ErrorBlock error={list.query.error} onRetry={() => void list.query.refetch()} title="Could not load campaigns" />;
  const items = list.query.data?.items ?? [];
  if (items.length === 0) return <EmptyBlock title="No campaigns open right now" body="Brands post campaigns here. Check back soon — new ones open every week." />;
  return (
    <>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm" data-testid="briefs-grid">
        {items.map((b) => (
          <BriefCard key={b.id} brief={b} />
        ))}
      </SimpleGrid>
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} shown={items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} busy={list.query.isFetching} />
    </>
  );
}

export function WithdrawButton({ app }: { app: CampaignApplication }) {
  const qc = useQueryClient();
  const withdraw = useMutation({
    mutationFn: () => partnershipsApi.withdraw(app.id),
    onSuccess: () => {
      toastSuccess('Application withdrawn');
      void qc.invalidateQueries({ queryKey: ['partnerships'] });
    },
    onError: (e) => toastError(e, 'Could not withdraw'),
  });
  if (app.state !== ApplicationState.Pending) return null;
  return (
    <Button
      size="xs"
      variant="subtle"
      color="signal"
      loading={withdraw.isPending}
      onClick={(e) => {
        e.stopPropagation();
        void confirmAction({ title: 'Withdraw your application?', body: 'You can apply again while the campaign is open.', confirmLabel: 'Withdraw', danger: true }).then(
          (ok) => ok && withdraw.mutate(),
        );
      }}
    >
      Withdraw
    </Button>
  );
}

function MyApplications() {
  const navigate = useNavigate();
  const brandOf = useBrandLookup();
  const list = useCursorList({ key: ['partnerships', 'applications'], fetchPage: partnershipsApi.applications });
  if (list.query.isPending) return <ListSkeleton rows={3} />;
  if (list.query.error) return <ErrorBlock error={list.query.error} onRetry={() => void list.query.refetch()} title="Could not load your applications" />;
  const items = list.query.data?.items ?? [];
  if (items.length === 0) return <EmptyBlock title="You haven’t applied to a campaign yet" body="Open a campaign to read the brief and apply." />;
  return (
    <>
      <DataList<CampaignApplication>
        items={items}
        rowKey={(a) => a.id}
        caption="My campaign applications"
        onOpen={(a) => navigate(`/briefs/${a.brandBriefId}`)}
        cardTitle={(a) => (
          <Text size="sm" fw={600}>
            {brandOf(a.vendorProfileId)?.businessName ?? 'A brand'}
          </Text>
        )}
        cardRight={(a) => (
          <Badge variant="light" color={applicationStateColor[a.state] ?? 'gray'}>
            {labelOf(applicationStateLabel, a.state)}
          </Badge>
        )}
        columns={[
          { key: 'brand', header: 'Brand', hideOnCard: true, render: (a) => brandOf(a.vendorProfileId)?.businessName ?? 'A brand' },
          { key: 'sent', header: 'Applied', render: (a) => formatDate(a.submittedUtc) },
          {
            key: 'state',
            header: 'Status',
            hideOnCard: true,
            render: (a) => (
              <Badge variant="light" color={applicationStateColor[a.state] ?? 'gray'}>
                {labelOf(applicationStateLabel, a.state)}
              </Badge>
            ),
          },
          {
            key: 'note',
            header: 'Note',
            render: (a) =>
              a.state === ApplicationState.Accepted ? (
                <Text size="xs">Accepted — answer the brand’s invite in Partnerships.</Text>
              ) : a.declineReason ? (
                <Text size="xs" c="dimmed" lineClamp={2}>
                  {a.declineReason}
                </Text>
              ) : (
                '—'
              ),
          },
          { key: 'actions', header: '', render: (a) => <WithdrawButton app={a} /> },
        ]}
      />
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} shown={items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} busy={list.query.isFetching} />
    </>
  );
}

export default function BriefsPage() {
  const [tab, setTab] = useTab(['open', 'mine'] as const, 'open');
  return (
    <>
      <PageHeader title="Briefs & campaigns" description="Campaigns brands are running now. Apply, and if the brand picks you, you get a partnership for the campaign’s products." />
      <Card>
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List mb="md">
            <Tabs.Tab value="open">Open campaigns</Tabs.Tab>
            <Tabs.Tab value="mine">My applications</Tabs.Tab>
          </Tabs.List>
          <Stack>{tab === 'open' ? <OpenBriefs /> : <MyApplications />}</Stack>
        </Tabs>
      </Card>
    </>
  );
}
