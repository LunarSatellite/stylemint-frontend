import type { ReactElement } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockApi, renderWithProviders } from '../../test/utils';
import CampaignsPage from './CampaignsPage';
import { CrmLayout } from './components';
import CustomerProfilePage from './CustomerProfilePage';
import CustomersPage from './CustomersPage';
import { can, visibleAreas } from './roles';
import SegmentsPage from './SegmentsPage';
import { crmSession, resetCrmSession } from './session';
import { TaskModal } from './TaskModal';
import { CRM, envelope, pagedEnvelope, SESSION, sellerCustomer, sessionBody } from './testkit';

const originalMatchMedia = window.matchMedia;

function setPhone(on: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: on && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

/** Renders a CRM page under the real CRM gate. */
function renderCrm(path: string, element: ReactElement, route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/crm" element={<CrmLayout />}>
        <Route path={path} element={element} />
      </Route>
    </Routes>,
    { route },
  );
}

beforeEach(() => resetCrmSession());
afterEach(() => {
  resetCrmSession();
  window.matchMedia = originalMatchMedia;
});

describe('CRM gate', () => {
  it('shows "being set up" when the session endpoint is not deployed (404)', async () => {
    mockApi({});
    renderCrm('customers', <CustomersPage />, '/crm/customers');
    expect(await screen.findByTestId('crm-setting-up')).toBeInTheDocument();
    expect(screen.getByText(/your customer crm is being set up/i)).toBeInTheDocument();
    expect(screen.queryByTestId('state-error')).not.toBeInTheDocument();
  });

  it('shows an error with retry when the session fails for another reason', async () => {
    mockApi({ [SESSION]: { status: 500, body: { title: 'Boom' } } });
    renderCrm('customers', <CustomersPage />, '/crm/customers');
    expect(await screen.findByTestId('state-error')).toBeInTheDocument();
    expect(screen.queryByTestId('crm-setting-up')).not.toBeInTheDocument();
  });
});

describe('customers', () => {
  it('lists synced buyers without ever showing phone or email, with paging', async () => {
    const calls = mockApi({
      [SESSION]: { body: sessionBody('Owner') },
      [`GET ${CRM}/seller/me`]: envelope({ customerCount: 30, lastSyncedUtc: new Date().toISOString(), backfill: { state: 'Done' } }),
      [`GET ${CRM}/seller/customers`]: (call) =>
        call.search.includes('page=2')
          ? pagedEnvelope([sellerCustomer({ contactId: 'c-26', fullName: 'Hari Thapa' })], { page: 2, total: 26 })
          : pagedEnvelope(
              Array.from({ length: 25 }, (_, i) => sellerCustomer({ contactId: `c-${i + 1}`, fullName: i === 0 ? 'Sita Sharma' : `Buyer ${i + 1}` })),
              { total: 26 },
            ),
    });
    renderCrm('customers', <CustomersPage />, '/crm/customers');
    expect(await screen.findByText('Sita Sharma')).toBeInTheDocument();
    expect(screen.getAllByText('Lalitpur').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rs 18,450').length).toBeGreaterThan(0);
    expect(screen.getByTestId('crm-privacy-note')).toHaveTextContent(/phone and email are hidden/i);
    expect(document.body.textContent).not.toMatch(/sita\.sharma@example\.com|9812345678/);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(await screen.findByText('Hari Thapa')).toBeInTheDocument();
    expect(calls.some((c) => c.path === `${CRM}/seller/customers` && c.search.includes('page=2'))).toBe(true);
  });

  it('uses cards on a phone', async () => {
    setPhone(true);
    mockApi({
      [SESSION]: { body: sessionBody('Owner') },
      [`GET ${CRM}/seller/customers`]: pagedEnvelope([sellerCustomer()]),
    });
    renderCrm('customers', <CustomersPage />, '/crm/customers');
    const cards = await screen.findByTestId('customer-cards');
    expect(within(cards).getByText('Sita Sharma')).toBeInTheDocument();
    expect(within(cards).getByText(/gets offers/i)).toBeInTheDocument();
  });

  it('says "could not load", not "no customers", when the list fails', async () => {
    mockApi({
      [SESSION]: { body: sessionBody('Owner') },
      [`GET ${CRM}/seller/customers`]: { status: 500, body: { success: false, message: 'Database is busy' } },
    });
    renderCrm('customers', <CustomersPage />, '/crm/customers');
    expect(await screen.findByText(/could not load customers/i)).toBeInTheDocument();
    expect(screen.getByText('Database is busy')).toBeInTheDocument();
    expect(screen.queryByTestId('state-empty')).not.toBeInTheDocument();
  });

  it('shows an empty state only when the server answered with nobody', async () => {
    mockApi({
      [SESSION]: { body: sessionBody('Owner') },
      [`GET ${CRM}/seller/customers`]: pagedEnvelope([]),
    });
    renderCrm('customers', <CustomersPage />, '/crm/customers');
    expect(await screen.findByText(/no customers yet/i)).toBeInTheDocument();
  });

  it('renders a profile with order stats and masked contact details', async () => {
    mockApi({
      [SESSION]: { body: sessionBody('Owner') },
      [`GET ${CRM}/seller/customers/c-1`]: envelope(sellerCustomer()),
      [`GET ${CRM}/contacts/c-1`]: envelope({ id: 'c-1', fullName: 'Sita Sharma', email: 'sita.sharma@example.com', phone: '+9779812345678', tagsJson: '["VIP"]', createdAt: '2026-03-02T05:00:00Z' }),
      [`GET ${CRM}/contacts/c-1/profile`]: envelope({ contact: { id: 'c-1', fullName: 'Sita Sharma' }, aiSummary: null, recentSignals: [], predictions: [], openTasks: [] }),
      [`GET ${CRM}/timeline/Contact/c-1`]: pagedEnvelope([]),
      [`GET ${CRM}/contacts/c-1/timeline`]: envelope({
        contact: { id: 'c-1', fullName: 'Sita Sharma' },
        deals: [],
        accounts: [],
        signals: [
          {
            id: 's-1',
            kind: 10,
            occurredAt: '2026-10-01T05:00:00Z',
            summary: 'Order #1042 placed – Rs 2,500. Call me on 9812345678',
            payloadJson: '{"type":"stylemint.order.placed"}',
          },
        ],
      }),
    });
    renderCrm('customers/:id', <CustomerProfilePage />, '/crm/customers/c-1');
    expect(await screen.findByRole('heading', { name: 'Sita Sharma' })).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Rs 18,450')).toBeInTheDocument();
    expect(screen.getByText('4.7 ★')).toBeInTheDocument();
    expect(screen.getByText(/gets offers/i)).toBeInTheDocument();
    expect(await screen.findByText('Order placed')).toBeInTheDocument();
    expect(screen.getByText(/Order #1042 placed – Rs 2,500\. Call me on \[phone hidden\]/)).toBeInTheDocument();
    expect(await screen.findByText('VIP')).toBeInTheDocument();
    expect(screen.getByTestId('crm-privacy-note')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/sita\.sharma@example\.com|9812345678|\+977/);
  });
});

describe('tasks', () => {
  it('creates a follow-up task about a customer', async () => {
    const calls = mockApi({
      [SESSION]: { body: sessionBody('Agent') },
      [`POST ${CRM}/tasks`]: envelope({ id: 't-1', title: 'Send size chart' }),
    });
    await crmSession.acquire();
    renderWithProviders(<TaskModal opened onClose={() => {}} customer={{ id: 'c-1', name: 'Sita Sharma' }} />);
    const user = userEvent.setup();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Sita Sharma')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/what needs doing/i), 'Send size chart');
    await user.click(within(dialog).getByRole('button', { name: /add task/i }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === `${CRM}/tasks`)).toBe(true));
    const body = calls.find((c) => c.method === 'POST' && c.path === `${CRM}/tasks`)!.body as Record<string, unknown>;
    expect(body).toMatchObject({ title: 'Send size chart', priority: 2, subjectKind: 2, subjectId: 'c-1', sourceKind: 1 });
    expect(calls.find((c) => c.path === `${CRM}/tasks`)!.headers.Authorization).toBe('Bearer crm-token-1');
  });
});

describe('campaigns respect consent', () => {
  const routes = (preview: unknown) => ({
    [SESSION]: { body: sessionBody('Owner') },
    [`GET ${CRM}/campaigns`]: envelope([]),
    [`GET ${CRM}/campaigns/aggregate`]: envelope({ totalCampaigns: 0, totalSent: 0, overallOpenRate: 0, totalConverted: 0, overallConversionRate: 0 }),
    [`POST ${CRM}/campaigns/preview`]: envelope(preview),
  });

  it('shows how many customers agreed to marketing and how many are skipped', async () => {
    mockApi(routes({ estimatedRecipients: 120, consentedRecipients: 84, contacts: [] }));
    renderCrm('campaigns', <CampaignsPage />, '/crm/campaigns');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /new campaign/i }));
    const consent = await screen.findByTestId('consent-count');
    expect(consent).toHaveTextContent('84 agreed to marketing and will get it');
    expect(consent).toHaveTextContent('36 skipped (no consent)');
    expect(screen.getByText(/120/)).toBeInTheDocument();
    expect(screen.getByText(/email only to buyers who opted in/i)).toBeInTheDocument();
  });

  it('counts consent from the contacts when the total is not reported', async () => {
    mockApi(
      routes({
        estimatedRecipients: 3,
        contacts: [
          { contactId: 'a', fullName: 'A', canMessage: true, hasMarketingConsent: true },
          { contactId: 'b', fullName: 'B', hasMarketingConsent: false },
          { contactId: 'c', fullName: 'C', hasMarketingConsent: true },
        ],
      }),
    );
    renderCrm('campaigns', <CampaignsPage />, '/crm/campaigns');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /new campaign/i }));
    expect(await screen.findByTestId('consent-count')).toHaveTextContent('2 agreed to marketing and will get it · 1 skipped');
  });

  it('says consent is checked at send time when it cannot be counted', async () => {
    mockApi(routes({ estimatedRecipients: 40, contacts: [] }));
    renderCrm('campaigns', <CampaignsPage />, '/crm/campaigns');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /new campaign/i }));
    expect(await screen.findByTestId('consent-unknown')).toHaveTextContent(/only customers who agreed to marketing receive it/i);
  });
});

describe('role-based hiding', () => {
  it('maps vendor roles to CRM capabilities', () => {
    expect(can('Owner', 'records.delete')).toBe(true);
    expect(can('Admin', 'segments.manage')).toBe(true);
    expect(can('Agent', 'campaigns.manage')).toBe(true);
    expect(can('Agent', 'records.delete')).toBe(false);
    expect(can('Agent', 'segments.manage')).toBe(false);
    expect(can('Agent', 'automations.manage')).toBe(false);
    expect(can(null, 'customers.view')).toBe(false);
    expect(visibleAreas('Agent').map((a) => a.key)).toEqual(['customers', 'tasks', 'segments', 'campaigns', 'feedback', 'deals', 'reports']);
    expect(visibleAreas('Owner', ['customers', 'tasks']).map((a) => a.key)).toEqual(['customers', 'tasks']);
  });

  const segmentRoutes = (role: string) => ({
    [SESSION]: { body: sessionBody(role) },
    [`GET ${CRM}/customer-segments`]: envelope([
      {
        id: 'seg-1',
        name: 'Festival shoppers',
        description: 'Buy around Dashain',
        memberCount: 40,
        retentionRate: 0.5,
        actionRecommendations: [],
        status: 1,
        discoveredAt: '2026-10-01T00:00:00Z',
      },
    ]),
  });

  it('hides segment management from a team member (Agent)', async () => {
    mockApi(segmentRoutes('Agent'));
    renderCrm('segments', <SegmentsPage />, '/crm/segments');
    expect(await screen.findByText('Festival shoppers')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new segment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /find groups/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /keep this segment/i })).not.toBeInTheDocument();
  });

  it('shows segment management to the owner', async () => {
    mockApi(segmentRoutes('Owner'));
    renderCrm('segments', <SegmentsPage />, '/crm/segments');
    expect(await screen.findByText('Festival shoppers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new segment/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /find groups/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /keep this segment/i })).toBeInTheDocument();
  });

  it('hides note deletion from an Agent but lets them add notes', async () => {
    mockApi({
      [SESSION]: { body: sessionBody('Agent') },
      [`GET ${CRM}/seller/customers/c-1`]: envelope(sellerCustomer()),
      [`GET ${CRM}/contacts/c-1`]: envelope({ id: 'c-1', fullName: 'Sita Sharma', tagsJson: null, createdAt: '2026-03-02T05:00:00Z' }),
      [`GET ${CRM}/comments`]: envelope([
        { id: 'n-1', authorUserId: 'u-1', commentableKind: 1, commentableId: 'c-1', content: 'Prefers size M', parentCommentId: null, editedAt: null, createdAt: '2026-10-02T00:00:00Z' },
      ]),
    });
    renderCrm('customers/:id', <CustomerProfilePage />, '/crm/customers/c-1');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: /notes/i }));
    expect(await screen.findByText('Prefers size M')).toBeInTheDocument();
    expect(screen.getByLabelText(/add a private note/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete note/i })).not.toBeInTheDocument();
  });
});
