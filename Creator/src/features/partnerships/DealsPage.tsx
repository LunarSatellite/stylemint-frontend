import { Badge, Button, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDate, formatMoney, labelOf } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import { partnershipsApi, RetainerState, retainerStateColor, retainerStateLabel, squadStateLabel, type Retainer } from './api';

function Squads() {
  const qc = useQueryClient();
  const squads = useQuery({ queryKey: ['partnerships', 'squads'], queryFn: partnershipsApi.squads });
  const accept = useMutation({
    mutationFn: (id: string) => partnershipsApi.acceptSquad(id),
    onSuccess: () => {
      toastSuccess('You joined the squad');
      void qc.invalidateQueries({ queryKey: ['partnerships'] });
    },
    // The list does not say whether you already answered; the server does.
    onError: (e) => toastError(e, 'Could not join'),
  });
  if (squads.isPending) return <ListSkeleton rows={2} />;
  if (squads.error) return <ErrorBlock error={squads.error} onRetry={() => void squads.refetch()} title="Could not load your squads" />;
  if (squads.data.length === 0)
    return <EmptyBlock title="No squads yet" body="Brands sometimes invite a group of creators to post together for one campaign. Invites show up here." />;
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
      {squads.data.map((s) => (
        <Card key={s.id} padding="md">
          <Group justify="space-between" wrap="nowrap">
            <Text fw={600}>{s.name}</Text>
            <Badge variant="light">{labelOf(squadStateLabel, s.state)}</Badge>
          </Group>
          <Text size="sm" c="dimmed" mt={4}>
            {s.memberCount} creators · budget {formatMoney({ amount: s.budgetTotal, currency: s.budgetCurrency })} · since {formatDate(s.createdUtc)}
          </Text>
          {(s.state === 1 || s.state === 2) && (
            <Group mt="sm">
              <Button size="xs" loading={accept.isPending && accept.variables === s.id} onClick={() => accept.mutate(s.id)}>
                Join squad
              </Button>
            </Group>
          )}
        </Card>
      ))}
    </SimpleGrid>
  );
}

function RetainerActions({ r }: { r: Retainer }) {
  const qc = useQueryClient();
  const act = useMutation({
    mutationFn: (what: 'accept' | 'pause' | 'resume' | 'cancel') =>
      what === 'accept'
        ? partnershipsApi.acceptRetainer(r.id)
        : what === 'pause'
          ? partnershipsApi.pauseRetainer(r.id)
          : what === 'resume'
            ? partnershipsApi.resumeRetainer(r.id)
            : partnershipsApi.cancelRetainer(r.id),
    onSuccess: (_v, what) => {
      toastSuccess({ accept: 'Retainer accepted', pause: 'Retainer paused', resume: 'Retainer resumed', cancel: 'Retainer cancelled' }[what]);
      void qc.invalidateQueries({ queryKey: ['partnerships', 'retainers'] });
    },
    onError: (e) => toastError(e),
  });
  const busy = act.isPending;
  return (
    <Group gap="xs">
      {r.state === RetainerState.Draft && (
        <Button size="xs" loading={busy} onClick={() => act.mutate('accept')}>
          Accept
        </Button>
      )}
      {r.state === RetainerState.Active && (
        <Button size="xs" variant="default" loading={busy} onClick={() => act.mutate('pause')}>
          Pause
        </Button>
      )}
      {r.state === RetainerState.Paused && (
        <Button size="xs" variant="default" loading={busy} onClick={() => act.mutate('resume')}>
          Resume
        </Button>
      )}
      {(r.state === RetainerState.Active || r.state === RetainerState.Paused) && (
        <Button
          size="xs"
          variant="subtle"
          color="signal"
          loading={busy}
          onClick={() =>
            void confirmAction({
              title: 'Cancel this retainer?',
              body:
                r.state === RetainerState.Active
                  ? `It ends after the ${r.renewalNoticeDays}-day notice period. The brand is told.`
                  : 'It ends now. The brand is told.',
              confirmLabel: 'Cancel retainer',
              danger: true,
              cancelLabel: 'Keep it',
            }).then((ok) => ok && act.mutate('cancel'))
          }
        >
          Cancel
        </Button>
      )}
    </Group>
  );
}

function Retainers() {
  const retainers = useQuery({ queryKey: ['partnerships', 'retainers'], queryFn: partnershipsApi.retainers });
  if (retainers.isPending) return <ListSkeleton rows={2} />;
  if (retainers.error) return <ErrorBlock error={retainers.error} onRetry={() => void retainers.refetch()} title="Could not load your retainers" />;
  if (retainers.data.length === 0)
    return <EmptyBlock title="No retainers" body="A retainer is a monthly fee from a brand for a set number of reels. Brands propose them; they show up here." />;
  return (
    <Stack gap="sm">
      {retainers.data.map((r) => (
        <Card key={r.id} padding="md">
          <Group justify="space-between" wrap="wrap" gap="sm">
            <div>
              <Group gap="xs">
                <Text fw={650}>{formatMoney({ amount: r.monthlyAmount, currency: r.currency })} a month</Text>
                <Badge variant="light" color={retainerStateColor[r.state] ?? 'gray'}>
                  {labelOf(retainerStateLabel, r.state)}
                </Badge>
              </Group>
              <Text size="sm" mt={4}>
                {r.deliverablesPerMonth}
              </Text>
              <Text size="xs" c="dimmed" mt={2}>
                {r.autoRenew ? 'Renews automatically' : 'Does not renew'} · {r.totalPeriodsCompleted} months completed
                {r.nextBillingUtc ? ` · next payment ${formatDate(r.nextBillingUtc)}` : ''}
              </Text>
            </div>
            <RetainerActions r={r} />
          </Group>
        </Card>
      ))}
    </Stack>
  );
}

export default function DealsPage() {
  return (
    <>
      <PageHeader title="Squads & retainers" description="Group campaigns and monthly deals that brands offer you." />
      <Stack gap="md">
        <SectionCard title="Retainers">
          <Retainers />
        </SectionCard>
        <SectionCard title="Squads">
          <Squads />
        </SectionCard>
      </Stack>
    </>
  );
}
