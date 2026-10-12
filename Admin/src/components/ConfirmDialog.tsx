import { useEffect, useRef, useState } from 'react';

/**
 * Say what is about to happen, in the words of the thing happening.
 *
 * Not "Are you sure?" — that question has no information in it, and an
 * operator clicking through twenty of them a day stops reading. The
 * title names the action and the body names the consequence to a
 * specific person: "Ada Ops will be signed out of every browser."
 *
 * `requireReason` is on for the two endpoints that take one. The
 * reason is not decoration: it is the only thing the audit entry will
 * carry explaining why someone's MFA was removed, and this is the last
 * moment anyone knows.
 */
export interface ConfirmRequest {
  title: string;
  body: string;
  confirmLabel: string;
  tone?: 'normal' | 'danger';
  requireReason?: boolean;
}

export function ConfirmDialog({
  request,
  onCancel,
  onConfirm,
}: {
  request: ConfirmRequest | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const firstField = useRef<HTMLTextAreaElement | HTMLButtonElement>(null);

  useEffect(() => {
    if (request) {
      setReason('');
      firstField.current?.focus();
    }
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request, onCancel]);

  if (!request) return null;
  const needsReason = request.requireReason === true;
  const canConfirm = !needsReason || reason.trim().length >= 3;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-2xl border border-surface-border bg-bg-elevated p-6 shadow-soft"
      >
        <h2 id="confirm-title" className="text-sm font-extrabold text-text-primary">
          {request.title}
        </h2>
        <p className="mt-1 text-xs leading-5 text-text-secondary">{request.body}</p>

        {needsReason && (
          <label className="mt-4 flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Reason — recorded in the audit log
            </span>
            <textarea
              ref={firstField as React.RefObject<HTMLTextAreaElement>}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="rounded-lg border border-surface-border bg-bg-card px-3 py-2 text-sm font-normal tracking-normal text-text-primary placeholder:text-text-muted"
              placeholder="e.g. Lost device, confirmed with the operator by phone"
            />
          </label>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-surface-border px-3 py-2 text-sm font-bold text-text-secondary hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(reason.trim())}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-40 ${
              request.tone === 'danger'
                ? 'bg-red-500/90 text-white hover:bg-red-500'
                : 'bg-primary text-bg-primary hover:bg-primary-dark'
            }`}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
