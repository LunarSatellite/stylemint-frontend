import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import type { KycApplicationDetail } from '@/api/kyc';
import { installSession, resetSessionForTests } from '@/auth/session';
import { mockFetch, renderWithProviders, signInAs } from '@/test/utils';
import { KycDetailDrawer, serviceVendorFields } from './KycDetail';

const ITEM = '0f1e2d3c-0000-4000-8000-000000000123';

const item = { id: ITEM, applicantKind: 2, applicationId: 'app-1', accountId: 'acc-1', state: 1, assignedReviewerId: null, submittedUtc: '2026-10-18T00:00:00Z', dueByUtc: '2999-01-01T00:00:00Z', decidedUtc: null, decision: null, decisionReasonCode: null, decisionNote: null, rowVersion: null, applicantType: 'Vendor' };

function detail(patch: Partial<KycApplicationDetail> = {}): KycApplicationDetail {
  return {
    kycItemId: ITEM,
    applicantKind: 2,
    applicationId: 'app-1',
    accountId: 'acc-1',
    displayName: 'Himalayan Bank',
    legalName: 'Himalayan Bank Ltd',
    countryCode: 'NP',
    city: 'Kathmandu',
    addressLine: 'Kamaladi',
    website: null,
    registrationNumber: '12345/050',
    taxId: '300000001',
    story: null,
    commissionMinPercent: null,
    commissionMaxPercent: null,
    submittedUtc: '2026-10-18T00:00:00Z',
    expectedDecisionByUtc: null,
    documents: [],
    applicantType: 'Vendor',
    fullName: null,
    dateOfBirth: null,
    documentType: null,
    documentNumberLast4: null,
    documentNumberMasked: null,
    stateProvince: null,
    postalCode: null,
    previousAttempts: null,
    serviceCategory: 3,
    serviceCategoryName: 'Bank',
    licenceNumber: 'NRB-A-012',
    licenceIssuer: 'Nepal Rastra Bank',
    licenceExpiresOn: '2999-07-15',
    ...patch,
  };
}

beforeEach(() => {
  installSession();
  resetSessionForTests();
  signInAs(['KycReviewer']);
});
afterEach(() => vi.unstubAllGlobals());

describe('service vendor applications', () => {
  it('shows a bank’s category and NRB licence, says banks pay no commission, and keeps the decision form', async () => {
    mockFetch((req) => {
      if (req.path === `/v1/admin/kyc/${ITEM}`) return { body: item };
      if (req.path === `/v1/admin/kyc/${ITEM}/application`) return { body: detail() };
      return undefined;
    });
    renderWithProviders(<KycDetailDrawer itemId={ITEM} onClose={() => {}} />);
    expect(await screen.findByTestId('service-category')).toHaveTextContent('Bank');
    expect(screen.getByText('NRB licence number')).toBeInTheDocument();
    expect(screen.getByTestId('licence-number')).toHaveTextContent('NRB-A-012');
    expect(screen.getByText('Nepal Rastra Bank')).toBeInTheDocument();
    expect(screen.getByText(/banks pay no commission/)).toBeInTheDocument();
    expect(screen.queryByText('Not collected')).toBeNull();
    // Approve / reject works as before.
    expect(screen.getByRole('button', { name: /Claim for review/ })).toBeInTheDocument();
  });

  it('flags a bank without a licence number and an expired licence', () => {
    const fields = serviceVendorFields(detail({ licenceNumber: null, licenceExpiresOn: '2020-01-01' }));
    const labels = fields.map((f) => f.label);
    expect(labels).toEqual(['Offers', 'NRB licence number', 'Licence issued by', 'Licence valid until']);
    renderWithProviders(<>{fields.map((f) => <div key={f.label}>{f.value}</div>)}</>);
    expect(screen.getByText('Missing')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('shows hotels and travel agencies with a tourism licence, and product sellers with no licence rows', () => {
    expect(serviceVendorFields(detail({ serviceCategory: 1, serviceCategoryName: 'Hotel', licenceNumber: null })).map((f) => f.label)).toContain('Tourism licence number');
    const product = serviceVendorFields(detail({ serviceCategory: 0, licenceNumber: null }));
    expect(product).toHaveLength(1);
    expect(product[0]!.value).toBe('Product seller');
    // An older server without the field: a product seller.
    expect(serviceVendorFields(detail({ serviceCategory: undefined }))).toHaveLength(1);
  });
});
