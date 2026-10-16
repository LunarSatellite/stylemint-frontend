import { Alert, Anchor, Badge, Card, Group, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { IconReceipt } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ApiError, isMissingEndpoint } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDateTime, formatMoney } from '../../lib/format';
import { useIsPhone } from '../../lib/useIsPhone';
import { emiApi, type Instalment } from './api';
import { EMI_PLANS_KEY, PlanBadges, PlansSettingUp } from './EmiPlansPage';
import {
  downPaymentStatusLabel,
  formatDueDate,
  kathmanduToday,
  planView,
  scheduleStatus,
  scheduleStatusLabel,
  type PlanView,
} from './plans';

const BACK = { to: '/emi-plans', label: 'EMI plans' };

function Row({ label, value, testId, strong }: { label: string; value: string; testId?: string; strong?: boolean }) {
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start" data-testid={testId}>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={strong ? 700 : 500} ta="right">
        {value}
      </Text>
    </Group>
  );
}

function lateFee(i: Instalment, m: (n: number) => string): string {
  const waived = i.lateFeeWaived ?? 0;
  if (i.lateFeeDue > 0) return waived > 0 ? `${m(i.lateFeeDue)} (${m(waived)} waived)` : m(i.lateFeeDue);
  return waived > 0 ? `${m(waived)} waived` : '—';
}

function StatusChip({ i, today }: { i: Instalment; today: string }) {
  const s = scheduleStatusLabel[scheduleStatus(i, today)];
  return (
    <Badge color={s.color} variant={s.label === 'Overdue' ? 'filled' : 'light'} size="sm">
      {s.label}
    </Badge>
  );
}

function Schedule({ plan, today }: { plan: PlanView; today: string }) {
  const isPhone = useIsPhone();
  const m = (amount: number) => formatMoney({ amount, currency: plan.currency });
  if (plan.instalments.length === 0) return <EmptyBlock title="No schedule yet" body="The schedule appears once the plan is set up." />;
  if (isPhone)
    return (
      <Stack gap="xs">
        {plan.instalments.map((i) => (
          <Card key={i.number} withBorder padding="sm" data-testid={`instalment-${i.number}`}>
            <Group justify="space-between" wrap="nowrap">
              <Text fw={600} size="sm">
                Instalment {i.number}
              </Text>
              <StatusChip i={i} today={today} />
            </Group>
            <Text size="sm">
              {i.dueDate ? `Due ${formatDueDate(i.dueDate)}` : 'Due date set when the plan starts'} · {m(i.scheduledAmount)}
            </Text>
            <Text size="xs" c="dimmed">
              Late fee: {lateFee(i, m)} · Paid: {i.paidUtc ? formatDateTime(i.paidUtc) : '—'}
            </Text>
          </Card>
        ))}
      </Stack>
    );
  return (
    <Table.ScrollContainer minWidth={640}>
      <Table verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>#</Table.Th>
            <Table.Th>Due date</Table.Th>
            <Table.Th ta="right">Amount</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th ta="right">Late fee</Table.Th>
            <Table.Th>Paid on</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {plan.instalments.map((i) => (
            <Table.Tr key={i.number} data-testid={`instalment-${i.number}`}>
              <Table.Td>{i.number}</Table.Td>
              <Table.Td>{i.dueDate ? formatDueDate(i.dueDate) : 'When the plan starts'}</Table.Td>
              <Table.Td ta="right">{m(i.scheduledAmount)}</Table.Td>
              <Table.Td>
                <StatusChip i={i} today={today} />
              </Table.Td>
              <Table.Td ta="right">{lateFee(i, m)}</Table.Td>
              <Table.Td>{i.paidUtc ? formatDateTime(i.paidUtc) : '—'}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/** One EMI plan: the terms, the down payment, the full schedule and what has been collected. */
export default function EmiPlanDetailPage() {
  const { agreementId = '' } = useParams();
  const query = useQuery({
    queryKey: [...EMI_PLANS_KEY, agreementId],
    queryFn: () => emiApi.plan(agreementId),
    enabled: !!agreementId,
  });

  if (query.isPending)
    return (
      <>
        <PageHeader title="EMI plan" back={BACK} />
        <ListSkeleton rows={4} height={90} />
      </>
    );
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404 && !isMissingEndpoint(query.error);
    return (
      <>
        <PageHeader title="EMI plan" back={BACK} />
        {isMissingEndpoint(query.error) ? (
          <PlansSettingUp />
        ) : notFound ? (
          <Card>
            <EmptyBlock title="Plan not found" body="This EMI plan does not exist or is not on one of your products." />
          </Card>
        ) : (
          <ErrorBlock error={query.error} title="Could not load this plan" onRetry={() => void query.refetch()} />
        )}
      </>
    );
  }

  const today = kathmanduToday();
  const plan = planView(query.data, today);
  const app = plan.app;
  const a = app.agreement;
  const m = (amount: number) => formatMoney({ amount, currency: plan.currency });
  const monthly = app.monthlyInstalment;
  const next = plan.next;

  return (
    <>
      <PageHeader
        title={app.productName || 'EMI plan'}
        back={BACK}
        description={`Buyer: ${app.buyerDisplayName || 'Buyer'}${app.orderNumber ? ` · Order ${app.orderNumber}` : ''}`}
        meta={<PlanBadges plan={plan} />}
        actions={
          app.vendorSubOrderId ? (
            <Anchor component={Link} to={`/orders/${app.vendorSubOrderId}`} size="sm" data-testid="plan-order-link">
              <Group gap={4} wrap="nowrap">
                <IconReceipt size={16} aria-hidden /> Open order {app.orderNumber ?? ''}
              </Group>
            </Anchor>
          ) : undefined
        }
      />
      <Stack gap="md">
        {plan.overdue && (
          <Alert color="red" variant="light" title="An instalment is overdue">
            StyleMint reminds the buyer and charges any late fee. You do not need to contact them.
          </Alert>
        )}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <SectionCard title="Plan">
            <Stack gap={6}>
              <Row label="Item price" value={m(a.price)} testId="detail-price" />
              <Row
                label="Down payment"
                value={`${m(a.downPayment)} · ${downPaymentStatusLabel[plan.downPaymentStatus] ?? plan.downPaymentStatus}`}
                testId="detail-down-payment"
              />
              <Row label="Financed" value={m(a.financed)} testId="detail-financed" />
              <Row label="Tenure" value={`${a.tenureMonths} months`} testId="detail-tenure" />
              <Row label="Monthly instalment" value={m(monthly)} testId="detail-monthly" />
            </Stack>
          </SectionCard>
          <SectionCard title="Collections">
            <Stack gap={6}>
              <Row label="Collected so far" value={m(plan.collected)} strong testId="detail-collected" />
              <Row label="Remaining" value={m(plan.remaining)} strong testId="detail-remaining" />
              <Row
                label="Instalments paid"
                value={`${plan.instalmentsPaid} of ${plan.instalmentsPaid + plan.instalmentsRemaining}`}
                testId="detail-count"
              />
              <Row
                label="Next due"
                value={
                  next
                    ? `${next.dueDate ? formatDueDate(next.dueDate) : 'When the plan starts'} · ${m(next.outstanding || next.scheduledAmount)}`
                    : '—'
                }
                testId="detail-next"
              />
              {plan.lateFeesOutstanding > 0 && (
                <Row label="Late fees unpaid" value={m(plan.lateFeesOutstanding)} testId="detail-late-fees" />
              )}
            </Stack>
          </SectionCard>
        </SimpleGrid>
        <SectionCard title="Schedule" description="Due dates are Nepal calendar days.">
          <Schedule plan={plan} today={today} />
        </SectionCard>
      </Stack>
    </>
  );
}
