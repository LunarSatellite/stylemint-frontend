import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { mockApi, renderWithProviders } from '../../test/utils';
import EmiPlanDetailPage from './EmiPlanDetailPage';
import EmiPlansPage from './EmiPlansPage';
import {
  daysBetween,
  formatDueDate,
  matchesFilter,
  planView,
  scheduleStatus,
  sellerNotificationRoute,
} from './plans';
import { dayFromToday, instalment, planApp } from './testkit';

const phone = vi.hoisted(() => ({ value: false }));
vi.mock('../../lib/useIsPhone', () => ({ useIsPhone: () => phone.value }));

const LIST = 'GET /v1/credit/vendor/plans';

/** Four plans: running (due in 10 days), overdue, due in 2 days, completed. */
function fixtures() {
  const running = planApp();
  const overdue = planApp(
    { buyerDisplayName: 'Bikash T.', productName: 'Wool shawl', orderNumber: 'NK2026-00102', vendorSubOrderId: 'so-102' },
    {
      id: 'ag-2',
      daysPastDue: 5,
      nextInstalment: instalment(2, { dueDate: dayFromToday(-5), state: 4, lateFeeDue: 250, outstanding: 8250 }),
      instalments: [
        instalment(1, { dueDate: dayFromToday(-35), paid: 8000, outstanding: 0, state: 3, paidUtc: '2026-09-10T04:00:00Z' }),
        instalment(2, { dueDate: dayFromToday(-5), state: 4, lateFeeDue: 250, outstanding: 8250 }),
      ],
    },
  );
  const soon = planApp(
    { buyerDisplayName: 'Chandra R.', productName: 'Silk kurta', orderNumber: 'NK2026-00103' },
    { id: 'ag-3', nextInstalment: instalment(1, { dueDate: dayFromToday(2) }), instalments: [instalment(1, { dueDate: dayFromToday(2) })] },
  );
  const done = planApp(
    { buyerDisplayName: 'Deepa S.', productName: 'Leather jacket', orderNumber: 'NK2026-00090' },
    {
      id: 'ag-4',
      state: 4,
      outstanding: 0,
      paidToDate: 60000,
      nextInstalment: null,
      instalmentsPaid: 6,
      instalmentsRemaining: 0,
      instalments: [instalment(1, { paid: 8000, outstanding: 0, state: 3 })],
    },
  );
  return [running, overdue, soon, done];
}

function renderList(route = '/emi-plans') {
  return renderWithProviders(
    <Routes>
      <Route path="/emi-plans" element={<EmiPlansPage />} />
    </Routes>,
    { route },
  );
}

function renderDetail(id = 'ag-1') {
  return renderWithProviders(
    <Routes>
      <Route path="/emi-plans/:agreementId" element={<EmiPlanDetailPage />} />
    </Routes>,
    { route: `/emi-plans/${id}` },
  );
}

describe('EMI plans list', () => {
  it('lists each plan with buyer name, item, order, financed, collected, remaining and next due', async () => {
    phone.value = false;
    mockApi({ [LIST]: { body: fixtures() } });
    renderList();
    const row = await screen.findByTestId('emi-plan-ag-1');
    expect(row).toHaveTextContent('Asha K.');
    expect(row).toHaveTextContent('Pashmina overcoat');
    expect(row).toHaveTextContent('NK2026-00101');
    expect(row).toHaveTextContent('Rs 48,000');
    expect(row).toHaveTextContent('Rs 20,000');
    expect(row).toHaveTextContent('Rs 40,000');
    expect(row).toHaveTextContent(`${formatDueDate(dayFromToday(10))} · Rs 8,000`);
    expect(within(row).queryByTestId('badge-overdue')).toBeNull();
    expect(within(screen.getByTestId('emi-plan-ag-2')).getByTestId('badge-overdue')).toBeInTheDocument();
  });

  it('filters by active, overdue, due soon and completed', async () => {
    phone.value = false;
    mockApi({ [LIST]: { body: fixtures() } });
    renderList();
    await screen.findByTestId('emi-plan-ag-1');
    const user = userEvent.setup();

    await user.click(screen.getByText(/^Overdue \(1\)$/));
    expect(screen.getByTestId('emi-plan-ag-2')).toBeInTheDocument();
    expect(screen.queryByTestId('emi-plan-ag-1')).toBeNull();

    await user.click(screen.getByText(/^Due soon \(1\)$/));
    expect(screen.getByTestId('emi-plan-ag-3')).toBeInTheDocument();
    expect(screen.queryByTestId('emi-plan-ag-2')).toBeNull();

    await user.click(screen.getByText(/^Completed \(1\)$/));
    expect(screen.getByTestId('emi-plan-ag-4')).toBeInTheDocument();
    expect(screen.queryByTestId('emi-plan-ag-1')).toBeNull();

    await user.click(screen.getByText(/^Active \(3\)$/));
    expect(screen.queryByTestId('emi-plan-ag-4')).toBeNull();
    expect(screen.getByTestId('emi-plan-ag-1')).toBeInTheDocument();
  });

  it('reads the filter from the URL and says when a filter has nothing', async () => {
    phone.value = false;
    mockApi({ [LIST]: { body: [planApp()] } });
    renderList('/emi-plans?filter=overdue');
    expect(await screen.findByText('Nothing overdue')).toBeInTheDocument();
  });

  it('shows cards on a phone', async () => {
    phone.value = true;
    mockApi({ [LIST]: { body: fixtures() } });
    renderList();
    const card = await screen.findByTestId('emi-plan-ag-1');
    expect(card.tagName).toBe('A');
    expect(card).toHaveAttribute('href', '/emi-plans/ag-1');
    expect(card).toHaveTextContent('Next due:');
    expect(screen.queryByRole('table')).toBeNull();
    phone.value = false;
  });

  it('empty: no plans yet', async () => {
    mockApi({ [LIST]: { body: [] } });
    renderList();
    expect(await screen.findByText('No EMI plans yet')).toBeInTheDocument();
  });

  it('404 with no error code: "being set up", never "no plans"', async () => {
    mockApi({});
    renderList();
    expect(await screen.findByTestId('state-setting-up')).toHaveTextContent(/being set up/i);
    expect(screen.queryByText('No EMI plans yet')).toBeNull();
  });

  it('a server error is an error with retry, never empty', async () => {
    mockApi({ [LIST]: { status: 500, body: { title: 'Server error' } } });
    renderList();
    expect(await screen.findByTestId('state-error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText('No EMI plans yet')).toBeNull();
  });

  it('never shows a buyer phone number or email, even if the server sends one', async () => {
    const leaky = planApp({
      buyerDisplayName: 'Asha asha@example.com 9841234567',
      ...({ buyerPhone: '+9779841234567', buyerEmail: 'asha@example.com' } as object),
    });
    mockApi({ [LIST]: { body: [leaky] }, 'GET /v1/credit/vendor/plans/ag-1': { body: leaky } });
    renderList();
    const row = await screen.findByTestId('emi-plan-ag-1');
    expect(row.textContent).not.toMatch(/asha@example\.com|9841234567/);
    expect(document.body.textContent).not.toMatch(/@example\.com|\+977|9841234567/);
  });
});

describe('EMI plan detail', () => {
  it('shows the terms, down payment status, collections and the full schedule, with a link to the order', async () => {
    phone.value = false;
    const app = planApp({}, {
      instalments: [
        instalment(1, { dueDate: '2026-09-25', paid: 8000, outstanding: 0, state: 3, paidUtc: '2026-09-25T04:00:00Z' }),
        instalment(2, { dueDate: dayFromToday(-3), state: 4, lateFeeDue: 250, outstanding: 8250 }),
        instalment(3, { dueDate: dayFromToday(40) }),
      ],
      daysPastDue: 3,
      lateFeesOutstanding: 250,
    });
    mockApi({ 'GET /v1/credit/vendor/plans/ag-1': { body: app } });
    renderDetail();
    expect(await screen.findByTestId('detail-price')).toHaveTextContent('Rs 60,000');
    expect(screen.getByTestId('detail-down-payment')).toHaveTextContent('Rs 12,000 · Paid online');
    expect(screen.getByTestId('detail-financed')).toHaveTextContent('Rs 48,000');
    expect(screen.getByTestId('detail-tenure')).toHaveTextContent('6 months');
    expect(screen.getByTestId('detail-monthly')).toHaveTextContent('Rs 8,000');
    expect(screen.getByTestId('detail-collected')).toHaveTextContent('Rs 20,000');
    expect(screen.getByTestId('detail-remaining')).toHaveTextContent('Rs 40,000');
    expect(screen.getByTestId('detail-late-fees')).toHaveTextContent('Rs 250');

    const first = screen.getByTestId('instalment-1');
    expect(first).toHaveTextContent('25 Sep 2026');
    expect(first).toHaveTextContent('Paid');
    const second = screen.getByTestId('instalment-2');
    expect(second).toHaveTextContent('Overdue');
    expect(second).toHaveTextContent('Rs 250');
    expect(screen.getByTestId('instalment-3')).toHaveTextContent('Due');
    expect(screen.getByText('An instalment is overdue')).toBeInTheDocument();

    expect(screen.getByTestId('plan-order-link')).toHaveAttribute('href', '/orders/so-101');
    expect(screen.getByTestId('plan-order-link')).toHaveTextContent('NK2026-00101');
  });

  it('a plan waiting for a cash down payment: collect on delivery, schedule starts with the plan', async () => {
    const app = planApp(
      { downPaymentStatus: 'collect_on_delivery' },
      {
        state: 2,
        activatedUtc: null,
        paidToDate: 0,
        outstanding: 48000,
        nextInstalment: instalment(1, { dueDate: null }),
        instalments: [instalment(1, { dueDate: null }), instalment(2, { dueDate: null })],
      },
    );
    mockApi({ 'GET /v1/credit/vendor/plans/ag-1': { body: app } });
    renderDetail();
    expect(await screen.findByTestId('detail-down-payment')).toHaveTextContent('Collect in cash on delivery');
    expect(screen.getByTestId('detail-collected')).toHaveTextContent('Rs 0');
    expect(screen.getByTestId('instalment-1')).toHaveTextContent('When the plan starts');
    expect(screen.getByText('Waiting for down payment')).toBeInTheDocument();
  });

  it('computes collected / remaining / next from the schedule when the new fields are absent', async () => {
    const app = planApp({ downPaymentStatus: undefined }, {
      paidToDate: undefined,
      nextInstalment: undefined,
      instalmentsPaid: undefined,
      instalmentsRemaining: undefined,
      lateFeesOutstanding: undefined,
    });
    mockApi({ 'GET /v1/credit/vendor/plans/ag-1': { body: app } });
    renderDetail();
    expect(await screen.findByTestId('detail-collected')).toHaveTextContent('Rs 20,000');
    expect(screen.getByTestId('detail-down-payment')).toHaveTextContent('Paid online');
    expect(screen.getByTestId('detail-count')).toHaveTextContent('1 of 6');
    expect(screen.getByTestId('detail-next')).toHaveTextContent(formatDueDate(dayFromToday(10)));
  });

  it('404 with no error code: being set up', async () => {
    mockApi({});
    renderDetail();
    expect(await screen.findByTestId('state-setting-up')).toBeInTheDocument();
  });

  it("404 with an error code (another seller's plan): not found", async () => {
    mockApi({
      'GET /v1/credit/vendor/plans/ag-9': { status: 404, body: { errorCode: 'credit_agreement.not_found', title: 'Not found' } },
    });
    renderDetail('ag-9');
    expect(await screen.findByText('Plan not found')).toBeInTheDocument();
    expect(screen.queryByTestId('state-setting-up')).toBeNull();
  });

  it('a server error offers a retry', async () => {
    mockApi({ 'GET /v1/credit/vendor/plans/ag-1': { status: 500, body: { title: 'Boom' } } });
    renderDetail();
    expect(await screen.findByTestId('state-error')).toBeInTheDocument();
  });

  it('never shows buyer contact details', async () => {
    const leaky = planApp({ buyerDisplayName: 'Asha 9841234567', ...({ buyerEmail: 'asha@example.com' } as object) });
    mockApi({ 'GET /v1/credit/vendor/plans/ag-1': { body: leaky } });
    renderDetail();
    await screen.findByTestId('detail-price');
    expect(document.body.textContent).not.toMatch(/@example\.com|9841234567/);
  });

  it('schedule cards on a phone', async () => {
    phone.value = true;
    mockApi({ 'GET /v1/credit/vendor/plans/ag-1': { body: planApp() } });
    renderDetail();
    expect(await screen.findByTestId('instalment-2')).toHaveTextContent('Instalment 2');
    expect(screen.queryByRole('table')).toBeNull();
    phone.value = false;
  });
});

describe('plan helpers', () => {
  it('schedule status follows the contract rule, by Kathmandu day', () => {
    const today = '2026-10-16';
    expect(scheduleStatus(instalment(1, { state: 3 }), today)).toBe('paid');
    expect(scheduleStatus(instalment(1, { state: 5 }), today)).toBe('paid');
    expect(scheduleStatus(instalment(1, { state: 4, dueDate: '2026-10-30' }), today)).toBe('overdue');
    expect(scheduleStatus(instalment(1, { dueDate: '2026-10-16' }), today)).toBe('due_today');
    expect(scheduleStatus(instalment(1, { dueDate: '2026-10-19' }), today)).toBe('due_soon');
    expect(scheduleStatus(instalment(1, { dueDate: '2026-10-20' }), today)).toBe('upcoming');
    expect(scheduleStatus(instalment(1, { dueDate: null }), today)).toBe('not_started');
    expect(scheduleStatus(instalment(1, { state: 'Paid' }), today)).toBe('paid');
  });

  it('accepts enum names as well as numbers', () => {
    const p = planView(planApp({}, { state: 'Completed' as unknown as number }), '2026-10-16');
    expect(matchesFilter(p, 'completed')).toBe(true);
    expect(p.remaining).toBe(0);
  });

  it('due dates are calendar days, never shifted by time zone', () => {
    expect(formatDueDate('2026-11-14')).toBe('14 Nov 2026');
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
  });

  it('seller plan notifications open the plan page', () => {
    expect(sellerNotificationRoute({ type: 'plan.vendor.overdue', deepLink: '/vendor/payment-plans/ag-1' })).toBe('/emi-plans/ag-1');
    expect(sellerNotificationRoute({ type: 'plan.vendor.completed', agreementId: 'ag-2' })).toBe('/emi-plans/ag-2');
    expect(sellerNotificationRoute({ type: 'plan.reminder.due', deepLink: '/payment-plans/ag-3' })).toBeNull();
  });
});
