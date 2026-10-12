/**
 * Step-up MFA. Sensitive endpoints (`[RequireStepUpMfa]`: role grants, disabling admins, revoking their sessions,
 * removing MFA, forcing payouts) answer 403 `admin.step_up.required` unless this session verified a TOTP code in the
 * last five minutes. `withStepUp` runs a write; on that answer it asks for a code once (the dialog is mounted once in
 * the shell), `POST /v1/admin/auth/mfa/totp/verify` (204, no new token), then runs the write again.
 */
import { ApiError } from '@/api/errors';
import { http } from '@/api/client';

type Prompt = () => Promise<void>;

let prompt: Prompt | null = null;

/** The StepUpDialog registers itself here; exactly one is mounted. */
export function registerStepUpPrompt(next: Prompt | null) {
  prompt = next;
}

export function verifyTotp(code: string) {
  return http.post<void>('/v1/admin/auth/mfa/totp/verify', { code: code.replace(/\s+/g, '') });
}

export async function withStepUp<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!(error instanceof ApiError) || !error.isStepUp) throw error;
    if (!prompt) throw error;
    // Resolves after a successful verify; rejects (code mfa.step_up_cancelled) when the operator cancels.
    await prompt();
    return run();
  }
}

export class StepUpCancelled extends ApiError {
  constructor() {
    super({ status: 499, code: 'mfa.step_up_cancelled', message: 'Cancelled - the change was not made.' });
  }
}
