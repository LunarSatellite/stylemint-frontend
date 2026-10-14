import { describe, expect, it } from 'vitest';
import { dropContactFields, EMAIL_MASK, PHONE_MASK, redactPii } from './redact';

describe('buyer privacy', () => {
  it('drops contact fields but keeps flags and ids', () => {
    const out = dropContactFields({
      id: 'a',
      buyerEmail: 'b@x.com',
      phoneNumber: '+9779812345678',
      hasEmail: true,
      nested: [{ customerPhone: '9812345678', name: 'Sita' }],
    });
    expect(out).toEqual({ id: 'a', hasEmail: true, nested: [{ name: 'Sita' }] });
  });

  it('leaves free text alone by default (captions are the creator’s own) and masks it in mask-text mode', () => {
    const text = { message: 'call me 9812345678 or mail sita@gmail.com', reelUrl: 'https://x/9812345678' };
    expect(dropContactFields(text)).toEqual(text);
    expect(redactPii(text, 'mask-text')).toEqual({ message: `call me ${PHONE_MASK} or mail ${EMAIL_MASK}`, reelUrl: 'https://x/9812345678' });
  });

  it('does not treat dates or order numbers as phone numbers', () => {
    expect(redactPii({ note: 'Order SM-2026101200123 on 2026-10-13' }, 'mask-text')).toEqual({ note: 'Order SM-2026101200123 on 2026-10-13' });
  });
});
