import { describe, expect, it } from 'vitest';
import { safeReturnTo } from '@/auth/oidc';
import { ageFrom, slotOf } from '@/api/kyc';
import { fmtMoney, humanize, mask, maskEmail, maskPhone } from './format';

describe('masking', () => {
  it('shows only the last four characters of an identity number', () => {
    expect(mask('12-01-74-05678')).toBe('••••••••5678');
    expect(mask('123')).toBe('•••');
    expect(mask(null)).toBe('—');
  });
  it('masks email and phone without losing what identifies the channel', () => {
    expect(maskEmail('asha.sharma@gmail.com')).toBe('as••••••@gmail.com');
    expect(maskPhone('+9779812345678')).toMatch(/^\+977•+5678$/);
  });
});

describe('labels and money', () => {
  it('humanises enum names', () => {
    expect(humanize('RejectedRetryable')).toBe('Rejected retryable');
    expect(humanize('KYC_IN_REVIEW')).toBe('Kyc in review');
  });
  it('formats decimal major units with the currency code', () => {
    expect(fmtMoney(1499.5, 'NPR')).toMatch(/NPR\s?1,499\.5/);
    expect(fmtMoney(null)).toBe('—');
  });
});

describe('sign-in return address', () => {
  it('only returns inside the console', () => {
    expect(safeReturnTo('/orders?state=2')).toBe('/orders?state=2');
    expect(safeReturnTo('https://evil.example')).toBe('/');
    expect(safeReturnTo('//evil.example')).toBe('/');
    expect(safeReturnTo('/\\evil')).toBe('/');
  });
});

describe('KYC helpers', () => {
  it('slots buyer photos for side-by-side comparison', () => {
    expect(slotOf({ kind: 'CitizenshipFront', documentType: 'Citizenship', side: 'Front' })).toBe('front');
    expect(slotOf({ kind: 'Selfie', documentType: 'SelfiePhoto', side: null })).toBe('selfie');
    expect(slotOf({ kind: 'PassportBio', documentType: 'Passport', side: null })).toBe('bio');
    expect(slotOf({ kind: null, documentType: 'DriversLicense', side: 'Back' })).toBe('back');
  });
  it('computes age from a date of birth', () => {
    expect(ageFrom('2008-10-13', new Date('2026-10-12T12:00:00'))).toBe(17);
    expect(ageFrom('2008-10-12', new Date('2026-10-12T12:00:00'))).toBe(18);
    expect(ageFrom(null)).toBeNull();
  });
});
