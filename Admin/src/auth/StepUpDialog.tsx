import { useEffect, useRef, useState } from 'react';
import { api } from '@/api/client';
import { errorCodeOf, getErrorMessage } from '@/api/errors';
import { useStepUpDialog } from './useMutationWithStepUp';

/**
 * The TOTP challenge that stands between an operator and the eight
 * actions that can demand it.
 *
 * It renders once, in `AppShell`. That is not a style preference: the
 * step-up store hands out a promise that only `succeed()` or
 * `cancel()` resolves, so if nothing renders this component the
 * promise never settles and the mutation that opened it hangs for
 * ever, with the button spinning and no error. Mounting it per page
 * would make that true for every page that forgot.
 *
 * Verification posts to `/auth/mfa/totp/verify` with `{ code }` —
 * `VerifyMfaVm`, read from the spec.
 */
export function StepUpDialog() {
  const isOpen = useStepUpDialog((s) => s.isOpen);
  const succeed = useStepUpDialog((s) => s.succeed);
  const cancel = useStepUpDialog((s) => s.cancel);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCode('');
    setError(null);
    setBusy(false);
    inputRef.current?.focus();
  }, [isOpen]);

  // Escape cancels, which rejects the waiting mutation rather than
  // leaving it pending.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, cancel]);

  if (!isOpen) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/v1/admin/auth/mfa/totp/verify', { code });
      succeed();
    } catch (err) {
      const errorCode = errorCodeOf(err);
      setError(getErrorMessage(errorCode));
      // A lockout is not something to retry against; close so the
      // operator reads the real message rather than typing into a
      // field that cannot succeed for fifteen minutes.
      if (errorCode === 'mfa.totp.locked') cancel();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stepup-title"
        className="w-full max-w-sm rounded-2xl border border-surface-border bg-bg-elevated p-6 shadow-soft"
      >
        <h2 id="stepup-title" className="text-sm font-extrabold text-text-primary">
          Confirm it is you
        </h2>
        <p className="mt-1 text-xs leading-5 text-text-muted">
          This action needs a fresh check. Enter the six-digit code from your authenticator app.
        </p>

        <label className="mt-4 flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Authentication code
          </span>
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="rounded-lg border border-surface-border bg-bg-card px-3 py-2 text-lg font-normal tracking-[0.3em] text-text-primary placeholder:text-text-muted placeholder:tracking-normal"
          />
        </label>

        {error && (
          <p role="alert" className="mt-3 text-xs font-semibold text-text-secondary">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={cancel}
            className="flex-1 rounded-lg border border-surface-border px-3 py-2 text-sm font-bold text-text-secondary hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-bg-primary disabled:opacity-40"
          >
            {busy ? 'Checking…' : 'Confirm'}
          </button>
        </div>
      </form>
    </div>
  );
}
