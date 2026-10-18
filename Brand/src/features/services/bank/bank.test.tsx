import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderWithProviders } from '../../../test/utils';
import { appointment, branch, lead, page, profileRoute, signInVendor } from '../testkit';
import { nextLeadStatuses, type BankProduct } from './api';
import AppointmentsPage from './AppointmentsPage';
import BankProductsPage, { rateText, validateProduct } from './BankProductsPage';
import { endTime, overlaps } from './BranchDetailPage';
import BranchesPage, { defaultHours, hoursSummary, validateBranch } from './BranchesPage';
import LeadDetailPage, { crmLinkFor } from './LeadDetailPage';
import LeadsPage from './LeadsPage';

vi.mock('../../../lib/useIsPhone', () => ({ useIsPhone: () => false }));

const BANK = profileRoute(3);

beforeEach(async () => {
  await signInVendor();
});

function renderBank(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/bank/leads" element={<LeadsPage />} />
      <Route path="/bank/leads/:id" element={<LeadDetailPage />} />
      <Route path="/bank/appointments" element={<AppointmentsPage />} />
      <Route path="/bank/products" element={<BankProductsPage />} />
      <Route path="/bank/branches" element={<BranchesPage />} />
    </Routes>,
    { route },
  );
}

function product(patch: Partial<BankProduct> = {}): BankProduct {
  return {
    id: 'bp-1',
    bankId: 'bank-1',
    bankName: 'Himalayan Bank',
    type: 4,
    name: 'Home Loan',
    summary: 'Up to 70% of property value',
    description: null,
    interestRateMinPercent: 9.5,
    interestRateMaxPercent: 11.25,
    rateNote: null,
    feesText: null,
    eligibilityText: null,
    documentsRequired: [],
    photoUrls: [],
    minAmount: 500000,
    maxAmount: 50000000,
    minTenureMonths: 12,
    maxTenureMonths: 300,
    currency: 'NPR',
    status: 1,
    publishedUtc: null,
    createdUtc: '2026-10-18T00:00:00Z',
    updatedUtc: '2026-10-18T00:00:00Z',
    ...patch,
  };
}

describe('lead status workflow', () => {
  it('moves forward only, may skip ahead, and can always close until finished', () => {
    expect(nextLeadStatuses(1)).toEqual([2, 3, 4, 5]);
    expect(nextLeadStatuses(2)).toEqual([3, 4, 5]);
    expect(nextLeadStatuses(3)).toEqual([4, 5]);
    expect(nextLeadStatuses(4)).toEqual([]);
    expect(nextLeadStatuses(5)).toEqual([]);
  });
});

describe('leads inbox', () => {
  it('lists new leads by default with the consented name, what it is about and the reference', async () => {
    const calls = mockApi({
      ...BANK,
      'GET /v1/vendor/bank/branches': { body: [] },
      'GET /v1/vendor/bank/leads': { body: page([lead(), lead({ id: 'lead-2', reference: 'APT-91B0C4', kind: 2, appointment: appointment(), contact: null, withdrawnUtc: '2026-10-18T06:00:00Z' })]) },
    });
    renderBank('/bank/leads');
    const row = await screen.findByTestId('lead-lead-1');
    expect(row).toHaveTextContent('ENQ-7F3A2C');
    expect(row).toHaveTextContent('Sita Sharma');
    expect(row).toHaveTextContent('Home Loan');
    expect(row).toHaveTextContent('Enquiry');
    // The list never shows contact details — only on the lead itself.
    expect(row).not.toHaveTextContent('+9779841000000');
    expect(screen.getByTestId('lead-lead-2')).toHaveTextContent('Withdrawn');
    expect(screen.getByTestId('lead-lead-2')).toHaveTextContent('New Road Branch');
    expect(calls.find((c) => c.path === '/v1/vendor/bank/leads')?.search).toContain('status=1');
  });

  it('filters by type and status on the server', async () => {
    const calls = mockApi({ ...BANK, 'GET /v1/vendor/bank/branches': { body: [] }, 'GET /v1/vendor/bank/leads': { body: page([]) } });
    renderBank('/bank/leads?kind=2&status=all');
    expect(await screen.findByText('No leads match')).toBeInTheDocument();
    const search = calls.filter((c) => c.path === '/v1/vendor/bank/leads').at(-1)!.search;
    expect(search).toContain('kind=2');
    expect(search).not.toContain('status=');
  });

  it('says the inbox is being set up while the endpoint is not deployed', async () => {
    mockApi({ ...BANK });
    renderBank('/bank/leads');
    expect(await screen.findByTestId('state-setting-up')).toHaveTextContent('Your leads inbox is being set up');
  });

  it('shows a real error with retry, not "no leads", when loading fails', async () => {
    mockApi({ ...BANK, 'GET /v1/vendor/bank/branches': { body: [] }, 'GET /v1/vendor/bank/leads': { status: 500, body: { title: 'Boom' } } });
    renderBank('/bank/leads');
    expect(await screen.findByTestId('state-error')).toBeInTheDocument();
    expect(screen.queryByText('No new leads')).toBeNull();
  });
});

describe('lead detail', () => {
  it('shows the consented contact details with the consent the buyer gave, the answers and the CRM link', async () => {
    mockApi({ ...BANK, 'GET /v1/vendor/bank/leads/lead-1': { body: lead() }, 'GET /v1/vendor/bank/leads/lead-1/notes': { body: [] } });
    renderBank('/bank/leads/lead-1');
    const contact = await screen.findByTestId('lead-contact');
    expect(contact).toHaveTextContent('Sita Sharma');
    expect(within(contact).getByRole('link', { name: /\+9779841000000/ })).toHaveAttribute('href', 'tel:+9779841000000');
    expect(within(contact).getByRole('link', { name: /sita@example.com/ })).toHaveAttribute('href', 'mailto:sita@example.com');
    expect(contact).toHaveTextContent('I agree that StyleMint shares my name');
    expect(screen.getByTestId('answer-loanAmount')).toHaveTextContent('Loan amount (NPR): 2500000');
    expect(screen.getByRole('link', { name: /Open in CRM/ })).toHaveAttribute('href', '/crm/customers?q=Sita%20Sharma');
  });

  it('after a withdrawal shows no contact details and asks not to contact the buyer', async () => {
    mockApi({
      ...BANK,
      'GET /v1/vendor/bank/leads/lead-1': { body: lead({ contact: null, status: 5, withdrawnUtc: '2026-10-18T06:00:00Z', closedReason: 'Withdrawn by the buyer' }) },
      'GET /v1/vendor/bank/leads/lead-1/notes': { body: [] },
    });
    renderBank('/bank/leads/lead-1');
    expect(await screen.findByTestId('contact-withdrawn')).toHaveTextContent('do not contact them');
    expect(screen.queryByTestId('lead-contact')).toBeNull();
    expect(screen.queryByText(/\+977/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark contacted' })).toBeNull();
  });

  it('marks a lead contacted, and closing it needs a reason', async () => {
    const calls = mockApi({
      ...BANK,
      'GET /v1/vendor/bank/leads/lead-1': { body: lead() },
      'GET /v1/vendor/bank/leads/lead-1/notes': { body: [] },
      'POST /v1/vendor/bank/leads/lead-1/status': (c) => ({ body: lead({ status: (c.body as { status: number }).status }) }),
    });
    renderBank('/bank/leads/lead-1');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Mark contacted' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ status: 2 }));
    expect(calls.find((c) => c.method === 'POST')?.headers['Idempotency-Key']).toBeTruthy();

    await user.click(await screen.findByRole('button', { name: 'Close lead' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Close lead' }));
    expect(await within(dialog).findByText('Give a short reason.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Why are you closing it/), 'Not eligible');
    await user.click(within(dialog).getByRole('button', { name: 'Close lead' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST').at(-1)?.body).toEqual({ status: 5, reason: 'Not eligible' }));
  });

  it('adds a note', async () => {
    const calls = mockApi({
      ...BANK,
      'GET /v1/vendor/bank/leads/lead-1': { body: lead() },
      'GET /v1/vendor/bank/leads/lead-1/notes': { body: [{ id: 'n1', leadId: 'lead-1', authorAccountId: 'a', text: 'Called once', createdUtc: '2026-10-18T05:00:00Z' }] },
      'POST /v1/vendor/bank/leads/lead-1/notes': { body: { id: 'n2', leadId: 'lead-1', authorAccountId: 'a', text: 'Will visit Sunday', createdUtc: '2026-10-18T06:00:00Z' } },
    });
    renderBank('/bank/leads/lead-1');
    expect(await screen.findByTestId('note-n1')).toHaveTextContent('Called once');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('New note'), 'Will visit Sunday');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path.endsWith('/notes'))?.body).toEqual({ text: 'Will visit Sunday' }));
  });

  it('says "Lead not found" for another bank’s lead (404 with a code)', async () => {
    mockApi({ ...BANK, 'GET /v1/vendor/bank/leads/x': { status: 404, body: { errorCode: 'service_lead.not_found', title: 'Not found' } } });
    renderBank('/bank/leads/x');
    expect(await screen.findByText('Lead not found')).toBeInTheDocument();
  });

  it('links to the CRM by the consented name, or the reference after a withdrawal', () => {
    expect(crmLinkFor(lead())).toBe('/crm/customers?q=Sita%20Sharma');
    expect(crmLinkFor(lead({ contact: null }))).toBe('/crm/customers?q=ENQ-7F3A2C');
  });
});

describe('appointments', () => {
  it('lists booked appointments by day and cancels one with a reason', async () => {
    const past = appointment({ id: 'apt-2', startUtc: '2026-01-01T04:15:00Z' });
    const future = appointment({ startUtc: '2999-01-01T04:15:00Z' });
    const calls = mockApi({
      ...BANK,
      'GET /v1/vendor/bank/branches': { body: [branch()] },
      'GET /v1/vendor/bank/appointments': { body: page([future, past]) },
      'POST /v1/vendor/bank/appointments/apt-1/cancel': { body: appointment({ status: 2 }) },
    });
    renderBank('/bank/appointments');
    const card = await screen.findByTestId('appointment-apt-1');
    expect(card).toHaveTextContent('10:00–10:30 · Ram Thapa');
    // Complete / no-show only once the slot has started.
    expect(within(card).queryByRole('button', { name: 'Mark completed' })).toBeNull();
    expect(within(screen.getByTestId('appointment-apt-2')).getByRole('button', { name: 'Mark completed' })).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/v1/vendor/bank/appointments')?.search).toContain('status=1');

    const user = userEvent.setup();
    await user.click(within(card).getByRole('button', { name: 'Cancel appointment' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Reason/), 'Branch closed for repairs');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel appointment' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ reason: 'Branch closed for repairs' }));
  });
});

describe('bank products', () => {
  it('lists products with type, rate and status, and publishes a draft after confirming', async () => {
    const calls = mockApi({
      ...BANK,
      'GET /v1/vendor/bank/products': { body: [product(), product({ id: 'bp-2', name: 'Savings Plus', type: 1, status: 2, interestRateMinPercent: 6, interestRateMaxPercent: 6 })] },
      'POST /v1/vendor/bank/products/bp-1/publish': { body: product({ status: 2 }) },
    });
    renderBank('/bank/products');
    const row = await screen.findByTestId('bank-product-bp-1');
    expect(row).toHaveTextContent('Home Loan');
    expect(row).toHaveTextContent('Loan');
    expect(row).toHaveTextContent('9.5% – 11.25% p.a.');
    expect(row).toHaveTextContent('Draft');
    expect(screen.getByTestId('bank-product-bp-2')).toHaveTextContent('6% p.a.');

    const user = userEvent.setup();
    await user.click(within(row).getByRole('button', { name: 'Actions for Home Loan' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Publish' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/v1/vendor/bank/products/bp-1/publish')).toBe(true));
  });

  it('creates a product as a draft with the contract body', async () => {
    const calls = mockApi({ ...BANK, 'GET /v1/vendor/bank/products': { body: [] }, 'POST /v1/vendor/bank/products': { body: product() } });
    renderBank('/bank/products');
    expect(await screen.findByText('No products yet')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New product' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Add product' }));
    expect(await within(dialog).findByText('Name needs 2–150 characters.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/^Name/), 'Savings Plus');
    await user.click(within(dialog).getByRole('button', { name: 'Add product' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/v1/vendor/bank/products')).toBe(true));
    const body = calls.find((c) => c.method === 'POST')!.body as Record<string, unknown>;
    expect(body).toMatchObject({ type: 1, name: 'Savings Plus', documentsRequired: [], photoUrls: [], currency: 'NPR' });
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('id');
  });

  it('checks the contract limits before sending', () => {
    const ok = { ...product(), summary: '', description: '' };
    expect(validateProduct(ok)).toEqual({});
    expect(validateProduct({ ...ok, interestRateMinPercent: 12, interestRateMaxPercent: 10 }).interestRateMinPercent).toBeDefined();
    expect(validateProduct({ ...ok, interestRateMinPercent: 120 }).interestRateMinPercent).toBeDefined();
    expect(validateProduct({ ...ok, minAmount: 10, maxAmount: 5 }).minAmount).toBeDefined();
    expect(validateProduct({ ...ok, minTenureMonths: 0 }).minTenureMonths).toBeDefined();
    expect(validateProduct({ ...ok, documentsRequired: Array.from({ length: 21 }, (_, i) => `doc ${i}`) }).documentsRequired).toBeDefined();
    expect(rateText({ interestRateMinPercent: null, interestRateMaxPercent: null })).toBe('—');
  });

  it('says products are being set up when the endpoint is missing', async () => {
    mockApi({ ...BANK });
    renderBank('/bank/products');
    expect(await screen.findByTestId('state-setting-up')).toBeInTheDocument();
  });
});

describe('branches', () => {
  it('lists branches with hours and appointment state', async () => {
    mockApi({ ...BANK, 'GET /v1/vendor/bank/branches': { body: [branch()] } });
    renderBank('/bank/branches');
    const card = await screen.findByTestId('branch-br-1');
    expect(card).toHaveTextContent('New Road Branch');
    expect(card).toHaveTextContent('Sun–Fri 10:00–17:00 · Sat closed');
    expect(card).toHaveTextContent('Appointments on');
  });

  it('summarises and validates opening hours, pins and names', () => {
    expect(hoursSummary(defaultHours())).toBe('Sun–Fri 10:00–17:00 · Sat closed');
    expect(hoursSummary([])).toBe('Sun–Sat closed');
    const w = { ...branch(), openingHours: defaultHours() };
    expect(validateBranch(w)).toBeNull();
    expect(validateBranch({ ...w, name: 'A' })).toMatch(/2–150/);
    expect(validateBranch({ ...w, latitude: 27.7, longitude: null })).toMatch(/both latitude and longitude/);
    expect(validateBranch({ ...w, openingHours: [{ dayOfWeek: 0, opens: '17:00', closes: '10:00', closed: false }] })).toMatch(/open before it closes/);
  });

  it('computes slot end times and refuses overlapping slots on the same day', () => {
    expect(endTime('10:00', 30)).toBe('10:30');
    expect(endTime('16:45', 30)).toBe('17:15');
    const existing = [{ id: 's1', branchId: 'br-1', dayOfWeek: 0, startTime: '10:00', durationMinutes: 30, capacity: 4, isActive: true }];
    expect(overlaps(existing, { dayOfWeek: 0, startTime: '10:15', durationMinutes: 30, capacity: 2 })?.id).toBe('s1');
    expect(overlaps(existing, { dayOfWeek: 0, startTime: '10:30', durationMinutes: 30, capacity: 2 })).toBeNull();
    expect(overlaps(existing, { dayOfWeek: 1, startTime: '10:00', durationMinutes: 30, capacity: 2 })).toBeNull();
    expect(overlaps(existing, { dayOfWeek: 0, startTime: '10:00', durationMinutes: 30, capacity: 2 }, 's1')).toBeNull();
  });
});
