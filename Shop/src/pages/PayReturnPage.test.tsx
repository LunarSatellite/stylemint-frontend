import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveCheckoutSession } from '../api/checkout';
import { checkoutSession, mockApi, renderApp, resetShop, routerPath, signIn } from '../test/utils';

const ORDER_NO = 'NK2026-00077';

describe('eSewa return page', () => {
  beforeEach(() => resetShop('signedOut'));

  it('success with an order number goes straight to the placed page', async () => {
    mockApi({});
    renderApp(`/pay/return?payment=success&o=${ORDER_NO}`);
    expect(await screen.findByText('Paid — your order is placed')).toBeInTheDocument();
    expect(screen.getByText(ORDER_NO)).toBeInTheDocument();
    expect(routerPath()).toBe(`/orders/${ORDER_NO}/placed?paid=1`);
  });

  it('pending: polls the saved checkout session until the order exists', async () => {
    signIn();
    saveCheckoutSession('sess-1');
    let polls = 0;
    const calls = mockApi({
      'GET /v1/checkout/sessions/sess-1': () => {
        polls++;
        return { body: polls < 2 ? checkoutSession({ status: 6 }) : checkoutSession({ status: 3, orderNumber: ORDER_NO }) };
      },
    });
    renderApp('/pay/return?payment=pending');
    expect(await screen.findByText('Confirming your eSewa payment…')).toBeInTheDocument();
    await waitFor(() => expect(routerPath()).toBe(`/orders/${ORDER_NO}/placed?paid=1`), { timeout: 5000 });
    expect(calls.filter((c) => c.path === '/v1/checkout/sessions/sess-1').length).toBe(2);
  });

  it('pending without a session (signed out) says the payment is being confirmed', async () => {
    mockApi({});
    renderApp('/pay/return?payment=pending');
    expect(await screen.findByText('Payment is being confirmed')).toBeInTheDocument();
  });

  it('a failed session while polling turns into the failed view', async () => {
    signIn();
    saveCheckoutSession('sess-1');
    mockApi({ 'GET /v1/checkout/sessions/sess-1': { body: checkoutSession({ status: 4 }) } });
    renderApp('/pay/return?payment=success');
    expect(await screen.findByText('Payment didn’t go through')).toBeInTheDocument();
  });

  it('failed: offers eSewa again, or switches the same session to cash on delivery', async () => {
    signIn();
    saveCheckoutSession('sess-1');
    const calls = mockApi({
      'POST /v1/checkout/sessions/sess-1/payment-method': { body: checkoutSession({ paymentMethod: 4 }) },
      'POST /v1/checkout/sessions/sess-1/place': { body: checkoutSession({ status: 3, orderNumber: ORDER_NO }) },
    });
    const user = userEvent.setup();
    renderApp('/pay/return?payment=failed');
    expect(await screen.findByText('Payment didn’t go through')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try eSewa again' })).toHaveAttribute('href', '/checkout?resume=1');
    await user.click(screen.getByRole('button', { name: 'Pay cash on delivery instead' }));
    expect(await screen.findByText('Your order is placed')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/v1/checkout/sessions/sess-1/payment-method')?.body).toEqual({ paymentMethod: 4 });
  });

  it('failed while signed out sends "try again" through sign-in', async () => {
    mockApi({});
    renderApp('/pay/return?payment=failed');
    expect(await screen.findByRole('link', { name: 'Try eSewa again' })).toHaveAttribute('href', '/signin?next=%2Fcheckout%3Fresume%3D1');
    expect(screen.queryByRole('button', { name: 'Pay cash on delivery instead' })).not.toBeInTheDocument();
  });
});
