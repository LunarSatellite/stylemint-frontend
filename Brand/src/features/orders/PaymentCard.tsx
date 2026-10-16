import { Anchor, Badge, Group, Stack, Text } from '@mantine/core';
import { IconCash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { isMissingEndpoint } from '../../api/client';
import { emiApi } from '../emi/api';
import { formatDueDate, planPath, planView } from '../emi/plans';
import { SectionCard } from '../../components/SectionCard';
import { formatMoney } from '../../lib/format';
import { downPaymentHow, PaymentMethod, planLabel, type OrderPaymentPlan, type SubOrderDetail } from './api';

function Row({ label, value, strong, testId }: { label: string; value: string; strong?: boolean; testId?: string }) {
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

/**
 * Collected so far / remaining / next due for the order's plan, from the seller plan endpoint
 * (emi-after-contract v1). Until that endpoint is deployed it 404s with no error code: the card
 * then says tracking is being set up — never "nothing collected".
 */
function PlanProgress({ agreementId }: { agreementId: string }) {
  const query = useQuery({
    queryKey: ['emi-plans', agreementId],
    queryFn: () => emiApi.plan(agreementId),
    staleTime: 60_000,
  });
  if (query.isPending) return null;
  if (query.isError) {
    return (
      <Text size="xs" c="dimmed" data-testid="plan-progress-unavailable">
        {isMissingEndpoint(query.error)
          ? 'Instalment tracking is being set up.'
          : 'Could not load what the buyer has paid so far.'}
      </Text>
    );
  }
  const p = planView(query.data);
  const m = (amount: number) => formatMoney({ amount, currency: p.currency });
  const next = p.next;
  return (
    <Stack gap={6} data-testid="plan-progress">
      <Row label="Collected so far" value={m(p.collected)} testId="plan-collected" />
      <Row label="Remaining" value={m(p.remaining)} testId="plan-remaining" />
      <Row
        label="Next due"
        value={
          next
            ? `${next.dueDate ? formatDueDate(next.dueDate) : 'when the plan starts'} · ${m(next.outstanding || next.scheduledAmount)}${p.overdue ? ' · overdue' : ''}`
            : '—'
        }
        testId="plan-next-due"
      />
      <Anchor component={Link} to={planPath(agreementId)} size="sm" data-testid="plan-detail-link">
        View plan and schedule
      </Anchor>
    </Stack>
  );
}

/** "EMI · Rs 30,000 down payment — collect in cash on delivery". */
export function planSummary(plan: OrderPaymentPlan): string {
  return `${planLabel(plan)} · ${formatMoney({ amount: plan.downPaymentAmount, currency: plan.currency })} down payment — ${downPaymentHow(plan)}`;
}

/** EMI marker for an order row. */
export function PlanBadge({ plan }: { plan?: OrderPaymentPlan | null }) {
  if (!plan) return null;
  return (
    <Badge color="cyan" variant="light" size="sm" title={planSummary(plan)}>
      {plan.downPaymentOnDelivery && !plan.downPaymentPaid ? `${planLabel(plan)} · cash down payment` : planLabel(plan)}
    </Badge>
  );
}

/**
 * How the buyer pays and what the rider collects. On an EMI order: the item price, the down
 * payment and how it is paid, the financed amount over the tenure, and the cash to collect —
 * only the down payment, never the full price.
 */
export function PaymentCard({ order: o }: { order: SubOrderDetail }) {
  const plan = o.paymentPlan ?? null;
  const cash =
    o.cashToCollectAmount != null && o.cashToCollectAmount > 0
      ? formatMoney({ amount: o.cashToCollectAmount, currency: o.cashToCollectCurrency ?? o.subtotalCurrency })
      : null;
  if (!plan && o.paymentMethod !== PaymentMethod.CashOnDelivery && cash === null) return null;
  const m = (amount: number) => formatMoney({ amount, currency: plan?.currency ?? o.subtotalCurrency });

  return (
    <SectionCard title={plan ? `Payment · ${planLabel(plan)}` : 'Payment'}>
      <Stack gap={6}>
        {plan ? (
          <>
            <Row label="Item price" value={m(plan.priceAmount)} />
            <Row label="Down payment" value={`${m(plan.downPaymentAmount)} · ${downPaymentHow(plan)}`} testId="plan-down-payment" />
            <Row
              label="Instalments"
              value={
                plan.tenureMonths > 0
                  ? `${m(plan.financedAmount)} over ${plan.tenureMonths} months (${m(plan.monthlyInstalmentAmount)}/month)`
                  : m(plan.financedAmount)
              }
              testId="plan-instalments"
            />
            {plan.agreementId && <PlanProgress agreementId={plan.agreementId} />}
          </>
        ) : (
          <Row label="Method" value="Cash on delivery" />
        )}
        <Group justify="space-between" wrap="nowrap" mt={4} data-testid="cash-to-collect">
          <Group gap={6} wrap="nowrap">
            <IconCash size={16} />
            <Text size="sm" fw={600}>
              Rider collects on delivery
            </Text>
          </Group>
          <Text size="sm" fw={700}>
            {cash ?? 'Nothing'}
          </Text>
        </Group>
        {plan && (
          <Text size="xs" c="dimmed">
            The instalments are collected by StyleMint after delivery. The rider never collects the full price.
          </Text>
        )}
      </Stack>
    </SectionCard>
  );
}
