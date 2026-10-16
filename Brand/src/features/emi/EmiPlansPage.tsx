import { Anchor, Badge, Card, Group, ScrollArea, SegmentedControl, Stack, Table, Text } from '@mantine/core';
import { IconTools } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useMemo, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { isMissingEndpoint } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatMoney } from '../../lib/format';
import { useIsPhone } from '../../lib/useIsPhone';
import { emiApi } from './api';
import {
  formatDueDate,
  isPlanFilter,
  kathmanduToday,
  matchesFilter,
  PLAN_FILTERS,
  planPath,
  planStateLabel,
  planView,
  type PlanFilter,
  type PlanView,
} from './plans';

export const EMI_PLANS_KEY = ['emi-plans'] as const;

/** The vendor plan endpoints 404 with no error code until the backend is deployed. */
export function PlansSettingUp() {
  return (
    <Card withBorder data-testid="state-setting-up">
      <Stack align="center" gap={6} py="lg" ta="center">
        <IconTools size={28} opacity={0.6} aria-hidden />
        <Text fw={600}>EMI plan tracking is being set up</Text>
        <Text size="sm" c="dimmed" maw={460}>
          Soon you will see every running EMI plan here — what the buyer has paid, what is left and when the next
          instalment is due. Your EMI requests still work as before.
        </Text>
      </Stack>
    </Card>
  );
}

export function PlanBadges({ plan }: { plan: PlanView }) {
  const state = planStateLabel[plan.state];
  return (
    <Group gap={6} wrap="wrap">
      {plan.overdue ? (
        <Badge color="red" variant="filled" size="sm" data-testid="badge-overdue">
          Overdue
        </Badge>
      ) : plan.dueSoon ? (
        <Badge color="yellow" variant="light" size="sm">
          Due soon
        </Badge>
      ) : null}
      {state && (
        <Badge color={state.color} variant="light" size="sm">
          {state.label}
        </Badge>
      )}
    </Group>
  );
}

function NextDue({ plan }: { plan: PlanView }) {
  if (!plan.next) return <>—</>;
  const amount = formatMoney({ amount: plan.next.outstanding || plan.next.scheduledAmount, currency: plan.currency });
  return (
    <>
      {plan.next.dueDate ? formatDueDate(plan.next.dueDate) : 'When the plan starts'} · {amount}
    </>
  );
}

function PlanRowCard({ plan }: { plan: PlanView }) {
  const m = (amount: number) => formatMoney({ amount, currency: plan.currency });
  const a = plan.app.agreement;
  return (
    <Card withBorder padding="md" component={Link} to={planPath(plan.id)} data-testid={`emi-plan-${plan.id}`}>
      <Stack gap={6}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div style={{ minWidth: 0 }}>
            <Text fw={650} truncate>
              {plan.app.productName || 'Product'}
            </Text>
            <Text size="sm" c="dimmed">
              {plan.app.buyerDisplayName || 'Buyer'} · {plan.app.orderNumber ?? 'No order yet'}
            </Text>
          </div>
          <PlanBadges plan={plan} />
        </Group>
        <Group gap="lg" wrap="wrap">
          <Stack gap={0}>
            <Text size="xs" c="dimmed">
              Financed
            </Text>
            <Text size="sm" fw={600}>
              {m(a.financed)}
            </Text>
          </Stack>
          <Stack gap={0}>
            <Text size="xs" c="dimmed">
              Collected
            </Text>
            <Text size="sm" fw={600}>
              {m(plan.collected)}
            </Text>
          </Stack>
          <Stack gap={0}>
            <Text size="xs" c="dimmed">
              Remaining
            </Text>
            <Text size="sm" fw={600}>
              {m(plan.remaining)}
            </Text>
          </Stack>
        </Group>
        <Text size="sm">
          Next due: <NextDue plan={plan} />
        </Text>
      </Stack>
    </Card>
  );
}

function PlansTable({ plans }: { plans: PlanView[] }) {
  return (
    <Card padding={0}>
      <Table.ScrollContainer minWidth={900}>
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Buyer</Table.Th>
              <Table.Th>Item</Table.Th>
              <Table.Th>Order</Table.Th>
              <Table.Th ta="right">Financed</Table.Th>
              <Table.Th ta="right">Collected</Table.Th>
              <Table.Th ta="right">Remaining</Table.Th>
              <Table.Th>Next due</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {plans.map((p) => {
              const m = (amount: number) => formatMoney({ amount, currency: p.currency });
              return (
                <Table.Tr key={p.id} data-testid={`emi-plan-${p.id}`}>
                  <Table.Td>{p.app.buyerDisplayName || 'Buyer'}</Table.Td>
                  <Table.Td>
                    <Anchor component={Link} to={planPath(p.id)} fw={600}>
                      {p.app.productName || 'Product'}
                    </Anchor>
                  </Table.Td>
                  <Table.Td>{p.app.orderNumber ?? '—'}</Table.Td>
                  <Table.Td ta="right">{m(p.app.agreement.financed)}</Table.Td>
                  <Table.Td ta="right">{m(p.collected)}</Table.Td>
                  <Table.Td ta="right">{m(p.remaining)}</Table.Td>
                  <Table.Td>
                    <NextDue plan={p} />
                  </Table.Td>
                  <Table.Td>
                    <PlanBadges plan={p} />
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}

const EMPTY_TEXT: Record<PlanFilter, { title: string; body: string }> = {
  all: {
    title: 'No EMI plans yet',
    body: 'When you approve an EMI request and the buyer checks out, the plan shows up here.',
  },
  active: { title: 'No active plans', body: 'Plans that are being paid off appear here.' },
  overdue: { title: 'Nothing overdue', body: 'No buyer is behind on an instalment.' },
  due_soon: { title: 'Nothing due in the next 3 days', body: 'Instalments due within 3 days appear here.' },
  completed: { title: 'No completed plans yet', body: 'Plans the buyer has paid in full appear here.' },
};

/** Running EMI plans on the seller's products: what each buyer has paid, what is left, what is next. */
export default function EmiPlansPage() {
  const isPhone = useIsPhone();
  const [params, setParams] = useSearchParams();
  const raw = params.get('filter');
  const filter: PlanFilter = isPlanFilter(raw) ? raw : 'all';
  const query = useQuery({ queryKey: EMI_PLANS_KEY, queryFn: () => emiApi.plans(), refetchInterval: 60_000 });

  const today = kathmanduToday();
  const all = useMemo(() => (query.data ?? []).map((app) => planView(app, today)), [query.data, today]);
  const shown = all.filter((p) => matchesFilter(p, filter));
  const counts = useMemo(
    () => Object.fromEntries(PLAN_FILTERS.map((f) => [f.value, all.filter((p) => matchesFilter(p, f.value)).length])),
    [all],
  );

  const setFilter = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === 'all') next.delete('filter');
    else next.set('filter', v);
    setParams(next, { replace: true });
  };

  let body: ReactNode;
  if (query.isPending) body = <ListSkeleton rows={4} height={isPhone ? 140 : 52} />;
  else if (query.error && isMissingEndpoint(query.error)) body = <PlansSettingUp />;
  else if (query.error) body = <ErrorBlock error={query.error} title="Could not load your EMI plans" onRetry={() => void query.refetch()} />;
  else if (shown.length === 0)
    body = (
      <Card>
        <EmptyBlock title={EMPTY_TEXT[filter].title} body={EMPTY_TEXT[filter].body} />
      </Card>
    );
  else if (isPhone)
    body = (
      <Stack gap="sm">
        {shown.map((p) => (
          <PlanRowCard key={p.id} plan={p} />
        ))}
      </Stack>
    );
  else body = <PlansTable plans={shown} />;

  return (
    <>
      <PageHeader
        title="EMI plans"
        description="Buyers paying for your products in monthly instalments. StyleMint collects the instalments; here you see what has come in and what is next."
        actions={
          <Anchor component={Link} to="/emi-requests" size="sm">
            EMI requests
          </Anchor>
        }
      />
      <Stack gap="md">
        <ScrollArea type="never" offsetScrollbars={false}>
          <SegmentedControl
            value={filter}
            onChange={setFilter}
            data={PLAN_FILTERS.map((f) => ({
              value: f.value,
              label: query.data && f.value !== 'all' ? `${f.label} (${counts[f.value] ?? 0})` : f.label,
            }))}
            aria-label="Filter EMI plans"
          />
        </ScrollArea>
        {body}
      </Stack>
    </>
  );
}
