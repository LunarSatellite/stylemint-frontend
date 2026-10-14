import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { mockApi, renderWithProviders, type RecordedCall } from '../../test/utils';
import AgreementDetailPage from './AgreementDetailPage';
import AgreementEditorPage, { validateTerms } from './AgreementEditorPage';
import AgreementsPage from './AgreementsPage';
import { defaultTerms } from './agreementsApi';
import { agreement, dialogWith, HASH, page, partnership, summary, terms } from './testkit';

const BASE = '/v1/vendor/agreements';

function renderAgreements(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/creators/agreements" element={<AgreementsPage />} />
      <Route path="/creators/agreements/new" element={<AgreementEditorPage mode="new" />} />
      <Route path="/creators/agreements/:id" element={<AgreementDetailPage />} />
      <Route path="/creators/agreements/:id/amend" element={<AgreementEditorPage mode="amend" />} />
    </Routes>,
    { route },
  );
}

const posted = (calls: RecordedCall[], path: string) => calls.find((c) => c.method === 'POST' && c.path === path);

describe('agreement terms checks', () => {
  it('needs a commission or a fee, sane ranges and described deliverables', () => {
    expect(validateTerms(defaultTerms())).toBeNull();
    expect(validateTerms(defaultTerms({ commissionRateMin: null, commissionRateMax: null, fixedFeeAmount: null }))).toMatch(/commission, a fixed fee/i);
    expect(validateTerms(defaultTerms({ commissionRateMin: 0.2, commissionRateMax: 0.1 }))).toMatch(/cannot be lower/i);
    expect(validateTerms(defaultTerms({ deliverables: [{ description: ' ', quantity: 1, platform: null, dueDate: null }] }))).toMatch(/describe every deliverable/i);
    expect(validateTerms(defaultTerms({ contentApproval: 3 }))).toMatch(/hours/i);
    expect(validateTerms(defaultTerms({ exclusive: true, exclusivityDays: null }))).toMatch(/exclusivity/i);
  });
});

describe('agreements list', () => {
  it('shows status, signatures and the end date, and warns about agreements ending soon', async () => {
    const soon = new Date(Date.now() + 10 * 86400_000).toISOString();
    const calls = mockApi({
      [`GET ${BASE}`]: (call) =>
        call.search.includes('expiringWithinDays')
          ? page([summary({ id: 'ag-2', status: 4, expiresAtUtc: soon })])
          : page([
              summary({ status: 3, vendorAccepted: false, creatorAccepted: true, sentUtc: '2026-10-13T06:00:00Z' }),
              summary({ id: 'ag-2', title: 'Retainer — Hari', status: 4, kind: 2, expiresAtUtc: soon, vendorAccepted: true, creatorAccepted: true }),
            ]),
    });
    renderAgreements('/creators/agreements');
    const table = await screen.findByTestId('agreement-table');
    expect(within(table).getByText('Partly signed')).toBeInTheDocument();
    expect(within(table).getByText('Active')).toBeInTheDocument();
    expect(within(table).getByLabelText('You not signed yet')).toBeInTheDocument();
    expect(within(table).getAllByLabelText('Creator signed').length).toBe(2);
    expect(within(table).getByText(/in 9 days|in 10 days/)).toBeInTheDocument();
    expect(await screen.findByTestId('expiring-alert')).toHaveTextContent(/1 agreement ends in the next 30 days/i);
    const list = calls.find((c) => c.path === BASE && !c.search.includes('expiringWithinDays'))!;
    expect(list.search).toContain('status=1');
    expect(list.search).toContain('status=4');
  });

  it('says agreements are being set up while the endpoint is not deployed', async () => {
    mockApi({});
    renderAgreements('/creators/agreements');
    expect(await screen.findByText(/agreements are being set up/i)).toBeInTheDocument();
    expect(screen.queryByTestId('state-error')).not.toBeInTheDocument();
  });

  it('shows "could not load" on a server error and an empty state when there are none', async () => {
    mockApi({ [`GET ${BASE}`]: { status: 500, body: { title: 'Agreements store unavailable' } } });
    const first = renderAgreements('/creators/agreements');
    expect(await screen.findByText(/could not load agreements/i)).toBeInTheDocument();
    expect(screen.queryByText(/no agreements here/i)).not.toBeInTheDocument();
    first.unmount();

    mockApi({ [`GET ${BASE}`]: page([]) });
    renderAgreements('/creators/agreements');
    expect(await screen.findByText(/no agreements here/i)).toBeInTheDocument();
  });
});

describe('create → send → status', () => {
  it('creates a draft for a partnership, then sends it for signature after confirming', async () => {
    let current = agreement();
    const calls = mockApi({
      'GET /v1/vendor/partnerships': page([partnership()]),
      'GET /v1/vendor/retainers': { body: [] },
      [`POST ${BASE}`]: () => ({ body: current }),
      [`GET ${BASE}/ag-1`]: () => ({ body: current }),
      [`POST ${BASE}/ag-1/send`]: () => {
        current = agreement({
          status: 2,
          sentUtc: '2026-10-13T06:00:00Z',
          versions: [{ ...agreement().versions[0], status: 2, sentUtc: '2026-10-13T06:00:00Z' }],
          events: [
            { type: 3, actorParty: 1, actorAccountId: 'v-1', versionNumber: 1, note: null, occurredUtc: '2026-10-13T06:00:00Z' },
            ...agreement().timeline,
          ],
        });
        return { body: current };
      },
    });
    const user = userEvent.setup();
    renderAgreements('/creators/agreements/new?kind=1&partnershipId=p-1');

    // Terms are seeded from the partnership: 10–15 %.
    const from = await screen.findByRole('textbox', { name: /commission from/i });
    await waitFor(() => expect(from).toHaveValue('10'));
    expect(screen.getByRole('textbox', { name: /up to/i })).toHaveValue('15');
    expect(screen.getByRole('textbox', { name: /^title/i })).toHaveValue('Partnership agreement — Sita Creator');

    await user.click(screen.getByRole('button', { name: /add deliverable/i }));
    await user.type(screen.getByRole('textbox', { name: /deliverable 1/i }), 'Styling reel');
    await user.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => expect(posted(calls, BASE)).toBeTruthy());
    expect(posted(calls, BASE)!.body).toMatchObject({
      kind: 1,
      partnershipId: 'p-1',
      retainerId: null,
      title: 'Partnership agreement — Sita Creator',
      terms: { commissionRateMin: 0.1, commissionRateMax: 0.15, deliverables: [{ description: 'Styling reel', quantity: 1 }], contentApproval: 1, payoutSchedule: 4 },
    });

    // Lands on the detail: draft text preview + Send for signature.
    expect(await screen.findByTestId('agreement-text')).toHaveTextContent(/governed by the laws of Nepal/i);
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /send for signature/i }));
    const confirm = await dialogWith(/you cannot edit it after sending/i);
    expect(posted(calls, `${BASE}/ag-1/send`)).toBeUndefined();
    await user.click(within(confirm).getByRole('button', { name: /send for signature/i }));

    await waitFor(() => expect(posted(calls, `${BASE}/ag-1/send`)).toBeTruthy());
    expect(await screen.findByText('Sent for signature', { selector: '.mantine-Badge-label' })).toBeInTheDocument();
    expect(within(screen.getByTestId('agreement-timeline')).getByText('Sent for signature')).toBeInTheDocument();
  });

  it('shows who signed when, and lets the shop sign the pending version with its terms hash', async () => {
    const pending = {
      ...agreement().versions[0],
      status: 2,
      acceptances: [{ party: 2, accountId: 'c-1', versionNumber: 1, acceptedUtc: '2026-10-13T08:30:00Z', userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/129.0', ipAddress: '27.34.1.1', termsHash: HASH }],
    };
    let current = agreement({ status: 3, creatorAccepted: true, versions: [pending] });
    const calls = mockApi({
      [`GET ${BASE}/ag-1`]: () => ({ body: current }),
      [`POST ${BASE}/ag-1/accept`]: () => {
        current = agreement({ status: 4, activeVersion: 1, vendorAccepted: true, creatorAccepted: true, versions: [{ ...pending, status: 3 }] });
        return { body: current };
      },
    });
    const user = userEvent.setup();
    renderAgreements('/creators/agreements/ag-1');
    const sigs = await screen.findByTestId('signatures');
    expect(within(sigs).getByText(/signed 13 oct 2026/i)).toHaveTextContent(/chrome on android/i);
    expect(sigs).not.toHaveTextContent('27.34.1.1');
    expect(within(sigs).getByText('Not signed yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /sign agreement/i }));
    const confirm = await dialogWith(/sign version 1\?/i);
    expect(within(confirm).getByText(HASH)).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: /sign agreement/i }));
    await waitFor(() => expect(posted(calls, `${BASE}/ag-1/accept`)?.body).toEqual({ versionNumber: 1, termsHash: HASH }));
    expect(await screen.findByText('Active', { selector: '.mantine-Badge-label' })).toBeInTheDocument();
  });
});

describe('amend and terminate', () => {
  const active = () =>
    agreement({
      status: 4,
      activeVersion: 1,
      vendorAccepted: true,
      creatorAccepted: true,
      versions: [{ ...agreement().versions[0], status: 3, terms: terms() }],
    });

  it('amends only with a reason and after confirming; the amendment is a new version', async () => {
    let current = active();
    const calls = mockApi({
      [`GET ${BASE}/ag-1`]: () => ({ body: current }),
      [`POST ${BASE}/ag-1/amend`]: () => {
        current = agreement({
          status: 5,
          currentVersion: 2,
          activeVersion: 1,
          versions: [{ ...agreement().versions[0], versionNumber: 2, status: 2, amendmentReason: 'Tihar extension' }, { ...agreement().versions[0], status: 3 }],
        });
        return { body: current };
      },
    });
    const user = userEvent.setup();
    renderAgreements('/creators/agreements/ag-1/amend');
    const fee = await screen.findByRole('textbox', { name: /fixed fee/i });
    await waitFor(() => expect(fee).toHaveValue('5,000'));
    await user.clear(fee);
    await user.type(fee, '8000');
    await user.click(screen.getByRole('button', { name: /send amendment/i }));
    expect(await screen.findByTestId('editor-error')).toHaveTextContent(/why the agreement is being amended/i);

    await user.type(screen.getByRole('textbox', { name: /why are you amending/i }), 'Tihar extension');
    await user.click(screen.getByRole('button', { name: /send amendment/i }));
    const confirm = await dialogWith(/current terms stay in force until both of you sign/i);
    expect(posted(calls, `${BASE}/ag-1/amend`)).toBeUndefined();
    await user.click(within(confirm).getByRole('button', { name: /send amendment/i }));

    await waitFor(() => expect(posted(calls, `${BASE}/ag-1/amend`)).toBeTruthy());
    expect(posted(calls, `${BASE}/ag-1/amend`)!.body).toMatchObject({ reason: 'Tihar extension', terms: { fixedFeeAmount: 8000, commissionRateMin: 0.1 } });
    expect(await screen.findByText(/amendment \(version 2\) waiting for signatures/i)).toBeInTheDocument();
  });

  it('does not amend when the seller cancels the confirmation', async () => {
    const calls = mockApi({ [`GET ${BASE}/ag-1`]: { body: active() } });
    const user = userEvent.setup();
    renderAgreements('/creators/agreements/ag-1/amend');
    await user.type(await screen.findByRole('textbox', { name: /why are you amending/i }), 'Change');
    await user.click(screen.getByRole('button', { name: /send amendment/i }));
    const confirm = await dialogWith(/current terms stay in force/i);
    await user.click(within(confirm).getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByText(/current terms stay in force/i)).not.toBeInTheDocument());
    expect(posted(calls, `${BASE}/ag-1/amend`)).toBeUndefined();
  });

  it('terminates only with a reason, then shows who ended it and why', async () => {
    let current = active();
    const calls = mockApi({
      [`GET ${BASE}/ag-1`]: () => ({ body: current }),
      [`POST ${BASE}/ag-1/terminate`]: () => {
        current = agreement({ status: 6, endedUtc: '2026-10-14T05:00:00Z', endedByParty: 1, endReason: 'Deliverables missed', versions: active().versions });
        return { body: current };
      },
    });
    const user = userEvent.setup();
    renderAgreements('/creators/agreements/ag-1');
    await user.click(await screen.findByRole('button', { name: /terminate agreement/i }));
    const dialog = await dialogWith(/ends the agreement with sita creator for good/i);
    await user.click(within(dialog).getByRole('button', { name: 'Terminate' }));
    expect(await within(dialog).findByText(/please give a reason/i)).toBeInTheDocument();
    expect(posted(calls, `${BASE}/ag-1/terminate`)).toBeUndefined();
    await user.type(within(dialog).getByRole('textbox', { name: /reason/i }), 'Deliverables missed');
    await user.click(within(dialog).getByRole('button', { name: 'Terminate' }));
    await waitFor(() => expect(posted(calls, `${BASE}/ag-1/terminate`)?.body).toEqual({ reason: 'Deliverables missed' }));
    expect(await screen.findByTestId('ended-alert')).toHaveTextContent(/by your shop — deliverables missed/i);
  });

  it('shows "could not load" for a broken agreement, not a blank page', async () => {
    mockApi({ [`GET ${BASE}/ag-1`]: { status: 500, body: { title: 'Boom' } } });
    renderAgreements('/creators/agreements/ag-1');
    expect(await screen.findByText(/could not load this agreement/i)).toBeInTheDocument();
  });
});
