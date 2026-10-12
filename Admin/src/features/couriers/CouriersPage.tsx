import { useState } from 'react';
import { useCourier } from '@/api/queries/useCourier';
import {
  usePassBackgroundCheck,
  usePassTraining,
  usePromoteToPro,
  usePromoteToTraveler,
  useRecomputeReliability,
  useReinstateCourier,
  useSuspendCourier,
} from '@/api/mutations/useCourierActions';
import { PageHeader } from '@/components/PageHeader';
import { ConfirmDialog, type ConfirmRequest } from '@/components/ConfirmDialog';
import { CourierProfileState } from '@/lib/enums';
import { CourierStateLabel, DeliveryTierLabel, VehicleLabel, labelOf } from '@/lib/formatters';
import { utcDate } from '@/lib/dates';

/**
 * A courier, looked up by profile id.
 *
 * There is no admin list endpoint for couriers: all nine admin
 * operations are writes against an id somebody already has. A support
 * agent arrives here from a ticket, so the page is a lookup rather
 * than a browse — and says so, instead of showing an empty table that
 * would imply there are no couriers.
 */
export function CouriersPage() {
  const [input, setInput] = useState('');
  const [lookedUp, setLookedUp] = useState<string | undefined>();
  const query = useCourier(lookedUp);
  const courier = query.data;

  const [pending, setPending] = useState<
    { request: ConfirmRequest; run: (reason: string) => void } | null
  >(null);

  const backgroundCheck = usePassBackgroundCheck();
  const training = usePassTraining();
  const promotePro = usePromoteToPro();
  const promoteTraveler = usePromoteToTraveler();
  const reinstate = useReinstateCourier();
  const recompute = useRecomputeReliability();
  const suspend = useSuspendCourier();

  const id = courier?.id ?? '';
  const suspended = courier?.state === CourierProfileState.Suspended;

  return (
    <section className="space-y-4">
      <PageHeader title="Couriers" />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLookedUp(input.trim() || undefined);
        }}
        className="flex items-end gap-2 rounded-xl border border-surface-border bg-bg-card p-4"
      >
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Courier profile ID
          </span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="From the support ticket"
            className="rounded-lg border border-surface-border bg-bg-elevated px-3 py-2 text-sm font-normal tracking-normal text-text-primary placeholder:text-text-muted"
          />
        </label>
        <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-bg-primary disabled:opacity-40"
        >
          Look up
        </button>
      </form>

      {!lookedUp ? (
        <Panel>
          Couriers cannot be browsed — the API has no list endpoint for them. Enter the profile ID
          from the ticket you are working.
        </Panel>
      ) : query.isError ? (
        <div className="rounded-xl border border-surface-border bg-bg-card px-6 py-10 text-center">
          <p className="text-sm font-bold text-text-primary">Could not read this courier</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-text-secondary">
            Either no courier has that ID, or this read does not accept an operator token — it is
            not an admin-scoped endpoint. The actions are admin-scoped and would still work; it is
            the profile that cannot be shown.
          </p>
        </div>
      ) : query.isPending ? (
        <Panel>Looking up…</Panel>
      ) : courier ? (
        <>
          <div className="grid grid-cols-2 gap-x-10 rounded-xl border border-surface-border bg-bg-card p-5 text-xs">
            <Field label="State" value={labelOf(CourierStateLabel, courier.state)} />
            <Field label="Tier" value={labelOf(DeliveryTierLabel, courier.currentTier)} />
            <Field label="Vehicle" value={labelOf(VehicleLabel, courier.vehicle ?? 0)} />
            <Field label="Failure streak" value={String(courier.failureStreak)} />
            <Field label="KYC verified" value={utcDate(courier.kycVerifiedUtc)} />
            <Field label="Background check" value={utcDate(courier.backgroundCheckPassedUtc)} />
            <Field label="Training passed" value={utcDate(courier.trainingPassedUtc)} />
            <Field label="Escrow" value={escrowOf(courier)} />
            {courier.suspendedUtc && (
              <Field
                label="Suspended"
                value={`${utcDate(courier.suspendedUtc)} — ${courier.suspendedReason ?? 'no reason recorded'}`}
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Act
              label="Pass background check"
              done={Boolean(courier.backgroundCheckPassedUtc)}
              onClick={() =>
                setPending({
                  request: {
                    title: 'Record the background check as passed?',
                    body: 'This states the check was done and cleared. It is part of what lets this courier carry packages.',
                    confirmLabel: 'Record as passed',
                  },
                  run: () => backgroundCheck.mutate({ courierProfileId: id }),
                })
              }
            />
            <Act
              label="Pass training"
              done={Boolean(courier.trainingPassedUtc)}
              onClick={() =>
                setPending({
                  request: {
                    title: 'Record training as passed?',
                    body: 'The courier is treated as trained from now on.',
                    confirmLabel: 'Record as passed',
                  },
                  run: () => training.mutate({ courierProfileId: id }),
                })
              }
            />
            <Act
              label="Promote to Traveler"
              done={Boolean(courier.travelerUnlockedUtc)}
              onClick={() =>
                setPending({
                  request: {
                    title: 'Promote to Traveler?',
                    body: 'The courier becomes eligible for longer-distance deliveries.',
                    confirmLabel: 'Promote',
                  },
                  run: () => promoteTraveler.mutate({ courierProfileId: id }),
                })
              }
            />
            <Act
              label="Promote to Pro"
              done={Boolean(courier.proUnlockedUtc)}
              onClick={() =>
                setPending({
                  request: {
                    title: 'Promote to Pro?',
                    body: 'The highest tier, and eligibility for the most valuable deliveries.',
                    confirmLabel: 'Promote',
                  },
                  run: () => promotePro.mutate({ courierProfileId: id }),
                })
              }
            />
            <Act
              label="Recompute reliability"
              onClick={() =>
                setPending({
                  request: {
                    title: 'Recompute reliability?',
                    body: 'Recalculates the score from delivery history. Nothing else changes.',
                    confirmLabel: 'Recompute',
                  },
                  run: () => recompute.mutate({ courierProfileId: id }),
                })
              }
            />
            {suspended ? (
              <Act
                label="Reinstate"
                onClick={() =>
                  setPending({
                    request: {
                      title: 'Reinstate this courier?',
                      body: 'They can accept deliveries again straight away.',
                      confirmLabel: 'Reinstate',
                    },
                    run: () => reinstate.mutate({ courierProfileId: id }),
                  })
                }
              />
            ) : (
              <Act
                label="Suspend"
                danger
                onClick={() =>
                  setPending({
                    request: {
                      title: 'Suspend this courier?',
                      body: 'They can take no further deliveries until somebody reinstates them. Anything already in their hands is not affected by this alone.',
                      confirmLabel: 'Suspend courier',
                      tone: 'danger',
                      requireReason: true,
                    },
                    run: (reason) => suspend.mutate({ courierProfileId: id, reason }),
                  })
                }
              />
            )}
          </div>
        </>
      ) : null}

      <ConfirmDialog
        request={pending?.request ?? null}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => {
          pending?.run(reason);
          setPending(null);
        }}
      />
    </section>
  );
}

function escrowOf(c: { escrowHeldAmount: number | null; escrowRequiredAmount: number | null; escrowCurrency: string | null }): string {
  if (c.escrowHeldAmount === null) return '—';
  const required = c.escrowRequiredAmount ?? 0;
  return `${c.escrowHeldAmount} of ${required} ${c.escrowCurrency ?? ''}`.trim();
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-surface-border bg-bg-card px-6 py-10 text-center text-sm text-text-muted">
      {children}
    </p>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-surface-border py-1.5">
      <span className="text-text-muted">{label}</span>
      <span className="text-right text-text-secondary">{value}</span>
    </div>
  );
}

/**
 * `done` marks a step already recorded. It greys the button rather
 * than hiding it: the operator needs to see that the check happened,
 * and a missing button reads as a missing feature.
 */
function Act({
  label,
  onClick,
  danger,
  done,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  done?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={done ? 'Already recorded' : undefined}
      className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light ${
        danger
          ? 'border-red-500/30 text-red-300 hover:bg-red-500/10'
          : done
            ? 'border-surface-border text-text-muted'
            : 'border-surface-border text-text-secondary hover:bg-surface-2'
      }`}
    >
      {label}
      {done ? ' ✓' : ''}
    </button>
  );
}
