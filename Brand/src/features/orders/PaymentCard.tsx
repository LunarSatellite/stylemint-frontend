import { Badge, Group, Stack, Text } from '@mantine/core';
import { IconCash } from '@tabler/icons-react';
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
