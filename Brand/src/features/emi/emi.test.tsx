import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderWithProviders } from '../../test/utils';
import EmiRequestsPage from './EmiRequestsPage';
import type { EmiApplication } from './api';

const app = (patch: Partial<EmiApplication> = {}): EmiApplication => ({
  agreement: {
    id: 'ag-1',
    productId: 'p-1',
    variantId: 'v-1',
    state: 1,
    stateReasons: ['kyc_required', 'manual_review_required'],
    currency: 'NPR',
    price: 60000,
    downPayment: 12000,
    financed: 48000,
    tenureMonths: 6,
    totalPayable: 60000,
    appliedUtc: '2026-10-14T05:00:00Z',
    documentsSubmittedUtc: '2026-10-14T05:10:00Z',
  },
  buyerDisplayName: 'Asha',
  productName: 'Pashmina overcoat',
  monthlyInstalment: 8000,
  documents: [
    { id: 'd-1', kind: 1, contentType: 'image/jpeg', sizeBytes: 1000, uploadedUtc: '2026-10-14T05:01:00Z' },
    { id: 'd-2', kind: 2, contentType: 'application/pdf', sizeBytes: 2000, uploadedUtc: '2026-10-14T05:02:00Z' },
  ],
  riskScore: 560,
  riskBand: 3,
  riskReasons: ['kyc_required', 'manual_review_required'],
  ...patch,
});

afterEach(() => vi.unstubAllGlobals());

describe('EMI requests', () => {
  it('lists pending requests with the plan, documents and notes, and no contact details', async () => {
    mockApi({ 'GET /v1/credit/vendor/applications': { body: [app()] } });
    renderWithProviders(<EmiRequestsPage />);
    const card = await screen.findByTestId('emi-application-ag-1');
    expect(within(card).getByText('Pashmina overcoat')).toBeInTheDocument();
    expect(within(card).getByText(/Buyer: Asha/)).toBeInTheDocument();
    expect(within(card).getByText(/6 months/)).toBeInTheDocument();
    expect(within(card).getByText(/8,000\/month/)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /identity document 1/i })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /financial proof 1 \(pdf\)/i })).toBeInTheDocument();
    expect(within(card).getByText(/Not verified by StyleMint/)).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/@|\+977/);
  });

  it('opens a document only on request, through a link asked for one at a time', async () => {
    const calls = mockApi({
      'GET /v1/credit/vendor/applications': { body: [app()] },
      'GET /v1/credit/vendor/agreements/ag-1/documents/d-2/link': { body: { url: 'https://blobs/x.pdf' } },
    });
    const open = vi.fn();
    vi.stubGlobal('open', open);
    renderWithProviders(<EmiRequestsPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /financial proof 1/i }));
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://blobs/x.pdf', '_blank', 'noopener,noreferrer'));
    expect(calls.filter((c) => c.path.endsWith('/link'))).toHaveLength(1);
  });

  it('approves with an idempotency key', async () => {
    const calls = mockApi({
      'GET /v1/credit/vendor/applications': { body: [app()] },
      'POST /v1/credit/vendor/agreements/ag-1/review': { body: {} },
    });
    renderWithProviders(<EmiRequestsPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^approve$/i }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/review'))).toBe(true));
    const review = calls.find((c) => c.path.endsWith('/review'))!;
    expect(review.body).toEqual({ approve: true });
    expect(review.headers['Idempotency-Key']).toBeTruthy();
  });

  it('declines with the reason the buyer will see', async () => {
    const calls = mockApi({
      'GET /v1/credit/vendor/applications': { body: [app()] },
      'POST /v1/credit/vendor/agreements/ag-1/review': { body: {} },
    });
    renderWithProviders(<EmiRequestsPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^decline$/i }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: /decline request/i });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/reason/i), 'Income too low');
    await user.click(confirm);
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/review'))).toBe(true));
    expect(calls.find((c) => c.path.endsWith('/review'))!.body).toEqual({ approve: false, note: 'Income too low' });
  });

  it('warns when the buyer has not sent documents yet', async () => {
    mockApi({
      'GET /v1/credit/vendor/applications': {
        body: [app({ documents: [], agreement: { ...app().agreement, documentsSubmittedUtc: null } })],
      },
    });
    renderWithProviders(<EmiRequestsPage />);
    expect(await screen.findByText(/has not sent their documents yet/i)).toBeInTheDocument();
  });
});
