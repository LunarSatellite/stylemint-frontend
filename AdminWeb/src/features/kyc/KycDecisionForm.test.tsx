import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { reasonCodesFor } from '@/api/kyc';
import { installSession, resetSessionForTests } from '@/auth/session';
import { mockFetch, renderWithProviders, signInAs } from '@/test/utils';
import { KycDecisionForm } from './KycDecisionForm';

const ITEM = '0f1e2d3c-0000-4000-8000-000000000123';

function decidedItem(decision: number) {
  return { id: ITEM, applicantKind: 2, applicationId: 'a', accountId: 'b', state: 3, assignedReviewerId: 'me', submittedUtc: '2026-10-10T00:00:00Z', dueByUtc: '2026-10-13T00:00:00Z', decidedUtc: '2026-10-12T00:00:00Z', decision, decisionReasonCode: null, decisionNote: null, rowVersion: null, applicantType: 'Vendor' };
}

beforeEach(() => {
  installSession();
  resetSessionForTests();
  signInAs(['KycReviewer']);
});
afterEach(() => vi.unstubAllGlobals());

describe('reason codes', () => {
  it('offer only retryable codes for "may reapply" and only terminal ones for "final"', () => {
    expect(reasonCodesFor(2, 2)).toEqual(['DOCS_UNCLEAR', 'DOCS_MISMATCH', 'CATEGORY_MISSING', 'POLICY_VIOLATION_RECOVERABLE']);
    expect(reasonCodesFor(3, 2)).toEqual(['FRAUD_SUSPECTED', 'SANCTIONS_HIT', 'UNDERAGE']);
    expect(reasonCodesFor(1, 2)).toEqual([]);
  });
  it('do not offer “category missing” for a buyer, who has no categories', () => {
    expect(reasonCodesFor(2, 3)).not.toContain('CATEGORY_MISSING');
  });
});

describe('KYC decision', () => {
  it('claims a pending application, then approves it - with no reason code', async () => {
    const { calls } = mockFetch((req) => {
      if (req.path.endsWith('/assign')) return { body: { ...decidedItem(0), state: 2, decision: null, decidedUtc: null } };
      if (req.path.endsWith('/decide')) return { body: decidedItem(1) };
      return undefined;
    });
    const onDecided = vi.fn();
    renderWithProviders(<KycDecisionForm item={{ id: ITEM, state: 1, applicantKind: 2 }} onDecided={onDecided} />);

    await userEvent.click(screen.getByRole('button', { name: 'Approve…' }));
    expect(screen.getByText(/will be assigned to you first/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm approval' }));

    await waitFor(() => expect(onDecided).toHaveBeenCalled());
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([`POST /v1/admin/kyc/${ITEM}/assign`, `POST /v1/admin/kyc/${ITEM}/decide`]);
    expect(calls[0]!.body).toEqual({});
    expect(calls[1]!.body).toEqual({ decision: 1, decisionReasonCode: null, decisionNote: null });
  });

  it('will not reject without a reason, then sends the code and the note under the API’s field names', async () => {
    const { calls } = mockFetch((req) => (req.path.endsWith('/decide') ? { body: decidedItem(2) } : undefined));
    renderWithProviders(<KycDecisionForm item={{ id: ITEM, state: 2, applicantKind: 2 }} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Reject - may reapply' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reject…' }));
    expect(await screen.findByText('Choose the reason for the rejection')).toBeInTheDocument();
    expect(calls).toHaveLength(0);

    await userEvent.click(screen.getByRole('textbox', { name: /Reason/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Documents unclear or unreadable' }));
    await userEvent.click(screen.getByRole('textbox', { name: 'Note' }));
    await userEvent.paste('The back of the licence is cut off.');
    await userEvent.click(screen.getByRole('button', { name: 'Reject…' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm rejection' }));

    await waitFor(() => expect(calls).toHaveLength(1));
    // Already in review: no assign call.
    expect(calls[0]!.path).toBe(`/v1/admin/kyc/${ITEM}/decide`);
    expect(calls[0]!.body).toEqual({ decision: 2, decisionReasonCode: 'DOCS_UNCLEAR', decisionNote: 'The back of the licence is cut off.' });
  });

  it('labels the note as a message to the buyer for EMI applications, and warns on a final rejection', async () => {
    renderWithProviders(<KycDecisionForm item={{ id: ITEM, state: 2, applicantKind: 3 }} suggestedReason="UNDERAGE" />);
    await userEvent.click(screen.getByRole('radio', { name: 'Reject - final' }));
    expect(screen.getByRole('textbox', { name: 'Message to the buyer' })).toBeInTheDocument();
    expect(screen.getByText(/cannot be appealed/)).toBeInTheDocument();
    // The suggested terminal reason is pre-selected.
    expect(screen.getByRole('textbox', { name: /Reason/ })).toHaveValue('Under 18');
  });

  it('keeps the form open with the server’s reason when the decision is refused', async () => {
    mockFetch(() => ({ status: 409, body: { errorCode: 'kyc.document_number_in_use', title: 'This ID number is already verified on another account.', status: 409, correlationId: 'c1' } }));
    renderWithProviders(<KycDecisionForm item={{ id: ITEM, state: 2, applicantKind: 3 }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Approve…' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm approval' }));
    expect(await screen.findByText(/already verified on another account/)).toBeInTheDocument();
    expect(screen.getByTestId('kyc-decision')).toBeInTheDocument();
  });
});
