/** Identity's password policy (PasswordCredentialService.CheckPolicy): 12–128 chars, a letter and a digit. */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export interface PasswordRule {
  id: 'length' | 'letter' | 'digit';
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: 'length',
    label: `${PASSWORD_MIN}–${PASSWORD_MAX} characters`,
    test: (v) => v.length >= PASSWORD_MIN && v.length <= PASSWORD_MAX,
  },
  { id: 'letter', label: 'At least one letter', test: (v) => /\p{L}/u.test(v) },
  { id: 'digit', label: 'At least one number', test: (v) => /\p{Nd}/u.test(v) },
];

export function passwordMeetsPolicy(value: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(value));
}
