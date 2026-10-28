import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockApi, renderWithProviders, type RecordedCall } from '../../test/utils';
import { page, signInVendor } from '../services/testkit';
import { ReturnState, type ReturnItem } from './api';
import CarePage from './CarePage';

const item = (patch: Partial<ReturnItem> = {}): ReturnItem => ({
  id: 'ret-1',
  orderId: 'o-1',
  subOrderId: 'so-1',
  orderNumber: 'SM-1001',
  productTitleSnapshot: 'Linen kurta',
  variantLabelSnapshot: 'M · Blue',
  thumbnailUrlSnapshot: null,
  quantity: 1,
  reason: 'Too small',
  state: ReturnState.Approved,
  submittedUtc: '2026-10-27T05:00:00Z',
  resolvedUtc: null,
  rejectionNote: null,
  resolution: 1,
  evidence: null,
  ...patch,
});

function renderReturns(items: ReturnItem[]) {
  const calls = mockApi({
    'GET /v1/vendor/returns': { body: page(items) },
    'POST /v1/vendor/returns/ret-1/complete': (c: RecordedCall) => ({ body: { ...item(), state: ReturnState.Completed, restocked: (c.body as { restock: boolean }).restock } }),
  });
  renderWithProviders(<CarePage />, { route: '/care' });
  return calls;
}

const completes = (calls: RecordedCall[]) => calls.filter((c) => c.method === 'POST' && c.path.endsWith('/complete'));

describe('seller "Item received" asks about restocking', () => {
  beforeEach(async () => {
    await signInVendor();
  });

  it('is ticked by default and sends restock: true', async () => {
    const calls = renderReturns([item()]);
    await userEvent.click(await screen.findByRole('button', { name: 'Item received' }));

    const dialog = await screen.findByRole('dialog');
    const box = within(dialog).getByRole('checkbox', { name: 'Put the item back in stock' });
    expect(box).toBeChecked();
    expect(within(dialog).getByText(/damaged or can’t be sold again/)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Yes, received' }));
    await waitFor(() => expect(completes(calls)).toHaveLength(1));
    expect(completes(calls)[0]!.body).toEqual({ restock: true });
  });

  it('sends restock: false when unticked', async () => {
    const calls = renderReturns([item()]);
    await userEvent.click(await screen.findByRole('button', { name: 'Item received' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Put the item back in stock' }));
    expect(within(dialog).getByRole('checkbox', { name: 'Put the item back in stock' })).not.toBeChecked();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Yes, received' }));
    await waitFor(() => expect(completes(calls)).toHaveLength(1));
    expect(completes(calls)[0]!.body).toEqual({ restock: false });
  });

  it('does not complete when cancelled', async () => {
    const calls = renderReturns([item()]);
    await userEvent.click(await screen.findByRole('button', { name: 'Item received' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(completes(calls)).toHaveLength(0);
  });

  it('shows whether a completed return went back in stock, and nothing when the server does not say', async () => {
    renderReturns([item({ state: ReturnState.Completed, restocked: false }), item({ id: 'ret-2', state: ReturnState.Completed })]);
    const labels = await screen.findAllByTestId('return-restocked');
    expect(labels).toHaveLength(1);
    expect(labels[0]).toHaveTextContent('Not put back in stock');
  });
});
