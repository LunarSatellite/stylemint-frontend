import { describe, expect, it } from 'vitest';
import { IdentifierType, normalizeNepalPhone, parseIdentifier } from './identifier';
import { passwordMeetsPolicy } from './passwordPolicy';

describe('Nepal phone normalisation', () => {
  it.each([
    ['9812345678', '+9779812345678'],
    ['981-234 5678', '+9779812345678'],
    ['09812345678', '+9779812345678'],
    ['9779812345678', '+9779812345678'],
    ['+977 981 234 5678', '+9779812345678'],
    ['00977-9812345678', '+9779812345678'],
    ['(01) 4412345', '+97714412345'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeNepalPhone(raw)).toBe(expected);
  });

  it('keeps another country code as typed', () => {
    expect(normalizeNepalPhone('+91 98765 43210')).toBe('+919876543210');
  });

  it('rejects junk', () => {
    expect(normalizeNepalPhone('12')).toBeNull();
    expect(normalizeNepalPhone('98123456789012')).toBeNull();
  });
});

describe('identifier parsing', () => {
  it('lower-cases emails and marks them Email (1)', () => {
    expect(parseIdentifier('  Shop@Gmail.COM ')).toMatchObject({ ok: true, type: IdentifierType.Email, value: 'shop@gmail.com' });
  });
  it('marks phones Phone (2) in E.164', () => {
    expect(parseIdentifier('9801234567')).toMatchObject({ ok: true, type: IdentifierType.Phone, value: '+9779801234567' });
  });
  it('explains what is wrong', () => {
    expect(parseIdentifier('')).toMatchObject({ ok: false });
    expect(parseIdentifier('shop@')).toMatchObject({ ok: false });
    expect(parseIdentifier('abc123')).toMatchObject({ ok: false });
  });
});

describe('password policy (12–128, a letter and a digit)', () => {
  it.each([
    ['abcdefghijk1', true],
    ['abcdefghij1', false],
    ['abcdefghijkl', false],
    ['123456789012', false],
    ['पासवर्ड-शब्द-२०२६', true],
    [`a1${'x'.repeat(127)}`, false],
  ])('%s → %s', (pw, ok) => {
    expect(passwordMeetsPolicy(pw)).toBe(ok);
  });
});
