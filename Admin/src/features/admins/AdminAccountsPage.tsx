import { useState } from 'react';
import { useAdminAccounts, type AdminAccount } from '@/api/queries/useAdminAccounts';
import {
  useDisableAdmin,
  useEnableAdmin,
  useGrantRole,
  useRemoveAdminMfa,
  useRevokeAllSessions,
  useRevokeRole,
} from '@/api/mutations/useAdminAccountActions';
import { DataTable, type Column } from '@/components/DataTable';
import { ListState } from '@/components/ListState';
import { PageHeader } from '@/components/PageHeader';
import { ConfirmDialog, type ConfirmRequest } from '@/components/ConfirmDialog';
import { useAuth } from '@/auth/store';
import { AdminAccountState, AdminRole } from '@/lib/enums';
import { AdminRoleLabel, labelOf } from '@/lib/formatters';
import { utcDate } from '@/lib/dates';
import type { AdminFilter } from '@/api/queryKeys';

/**
 * Who can get into this console, and what can be done to them.
 *
 * Each action states its consequence before it runs, then clears a
 * step-up challenge. Two of them also take a reason that goes on the
 * audit entry — removing someone's MFA with no recorded reason is a
 * hole in exactly the record an investigation would read.
 *
 * An operator cannot act on their own row. Disabling yourself locks
 * you out of the console that fixes it, and revoking your own sessions
 * ends the one you are using mid-action.
 */
export function AdminAccountsPage() {
  const [filter] = useState<AdminFilter>({ page: 1, pageSize: 25 });
  const query = useAdminAccounts(filter);
  const rows = query.data?.items ?? [];
  const me = useAuth((s) => s.claims);

  const [pending, setPending] = useState<
    { request: ConfirmRequest; run: (reason: string) => void } | null
  >(null);

  const disable = useDisableAdmin(filter);
  const enable = useEnableAdmin(filter);
  const revokeSessions = useRevokeAllSessions(filter);
  const removeMfa = useRemoveAdminMfa(filter);
  const grantRole = useGrantRole(filter);
  const revokeRole = useRevokeRole(filter);

  const name = (a: AdminAccount) => a.displayName || a.email;
  const isMe = (a: AdminAccount) => a.id === me?.sub;

  const columns: Column<AdminAccount>[] = [
    {
      header: 'Operator',
      cell: (a) => (
        <span className="font-semibold text-text-primary">
          {name(a)}
          {isMe(a) && <span className="ml-2 text-xs font-normal text-primary">You</span>}
        </span>
      ),
    },
    { header: 'Email', cell: (a) => a.email },
    {
      header: 'Roles',
      cell: (a) => (
        <div className="flex flex-wrap gap-1">
          {ROLES.map((role) => {
            const held = a.roles.includes(role);
            const roleName = labelOf(AdminRoleLabel, role);
            return (
              <button
                key={role}
                type="button"
                aria-pressed={held}
                disabled={isMe(a)}
                onClick={() =>
                  setPending({
                    request: held
                      ? {
                          title: `Take ${roleName} away from ${name(a)}?`,
                          body: `${name(a)} loses everything that role allows, immediately.`,
                          confirmLabel: `Revoke ${roleName}`,
                          tone: 'danger',
                        }
                      : {
                          title: `Give ${name(a)} the ${roleName} role?`,
                          body: ROLE_GRANTS[role] ?? `${name(a)} gains everything that role allows.`,
                          confirmLabel: `Grant ${roleName}`,
                        },
                    run: () =>
                      (held ? revokeRole : grantRole).mutate({
                        adminAccountId: a.id,
                        role,
                        roleName,
                      }),
                  })
                }
                className={`rounded border px-1.5 py-0.5 text-[10px] font-bold transition-colors disabled:opacity-40 ${
                  held
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-surface-border text-text-muted hover:bg-surface-2'
                }`}
              >
                {roleName}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      header: 'State',
      cell: (a) =>
        a.state === AdminAccountState.Disabled ? (
          <span className="text-text-muted">Disabled</span>
        ) : (
          <span className="text-primary">Active</span>
        ),
    },
    { header: 'Last signed in', cell: (a) => utcDate(a.lastLoginUtc) },
    {
      header: 'Actions',
      align: 'right',
      cell: (a) =>
        isMe(a) ? (
          <span className="text-xs text-text-muted">Not available on your own account</span>
        ) : (
          <div className="flex justify-end gap-2">
            {a.state === AdminAccountState.Disabled ? (
              <Action
                label="Enable"
                onClick={() =>
                  setPending({
                    request: {
                      title: `Let ${name(a)} sign in again?`,
                      body: `${name(a)} will be able to sign in to this console with the roles they already have.`,
                      confirmLabel: 'Enable account',
                    },
                    run: () => enable.mutate({ adminAccountId: a.id, displayName: name(a) }),
                  })
                }
              />
            ) : (
              <Action
                label="Disable"
                danger
                onClick={() =>
                  setPending({
                    request: {
                      title: `Stop ${name(a)} signing in?`,
                      body: `${name(a)} will be signed out and unable to sign in again until someone re-enables the account.`,
                      confirmLabel: 'Disable account',
                      tone: 'danger',
                    },
                    run: () => disable.mutate({ adminAccountId: a.id, displayName: name(a) }),
                  })
                }
              />
            )}

            <Action
              label="Sign out everywhere"
              onClick={() =>
                setPending({
                  request: {
                    title: `Sign ${name(a)} out of every session?`,
                    body: `Every browser ${name(a)} is signed in on will be signed out immediately. They can sign in again.`,
                    confirmLabel: 'Revoke sessions',
                    requireReason: true,
                  },
                  run: (reason) =>
                    revokeSessions.mutate({
                      adminAccountId: a.id,
                      displayName: name(a),
                      reason,
                    }),
                })
              }
            />

            <Action
              label="Remove MFA"
              danger
              onClick={() =>
                setPending({
                  request: {
                    title: `Remove two-factor authentication for ${name(a)}?`,
                    body: `${name(a)} will be able to sign in with single sign-on alone until they enrol a new authenticator. Only do this once you have confirmed who you are talking to.`,
                    confirmLabel: 'Remove MFA',
                    tone: 'danger',
                    requireReason: true,
                  },
                  run: (reason) =>
                    removeMfa.mutate({ adminAccountId: a.id, displayName: name(a), reason }),
                })
              }
            />
          </div>
        ),
    },
  ];

  return (
    <section className="space-y-4">
      <PageHeader
        title="Admin accounts"
        query={query}
        total={query.data?.totalCount}
        noun="operators"
      />

      <div className="overflow-hidden rounded-xl border border-surface-border bg-bg-card">
        <ListState
          query={query}
          isEmpty={rows.length === 0}
          noun="admin accounts"
          emptyTitle="No admin accounts."
        >
          <DataTable rows={rows} columns={columns} rowKey={(a) => a.id} />
        </ListState>
      </div>

      <p className="text-xs text-text-muted">
        Every action here asks for your authenticator code before it runs. A highlighted role is
        one the operator holds — click it to take it away.
      </p>

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

/** Shown in the order a person would reason about: most power first. */
const ROLES = [
  AdminRole.SuperAdmin,
  AdminRole.KycReviewer,
  AdminRole.ContentMod,
  AdminRole.SupportAgent,
  AdminRole.PayoutsOps,
  AdminRole.Readonly,
];

/**
 * What a role actually lets someone do, from the backend's own
 * comments on the enum. A grant dialog that says "gains everything
 * that role allows" tells the person granting it nothing.
 */
const ROLE_GRANTS: Record<number, string> = {
  [AdminRole.SuperAdmin]:
    'Everything in this console, including granting roles to other operators and removing their MFA.',
  [AdminRole.KycReviewer]: 'Review creator and vendor applications, and approve or reject them.',
  [AdminRole.ContentMod]:
    'Work the moderation queue, including hiding and removing content and suspending authors.',
  [AdminRole.SupportAgent]: 'Tickets, and read-only access to order and customer information.',
  [AdminRole.PayoutsOps]: 'Hold and release payouts, and issue manual refunds.',
  [AdminRole.Readonly]: 'Analytics and lookups. No writes anywhere.',
};

function Action({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light ${
        danger
          ? 'border-red-500/30 text-red-300 hover:bg-red-500/10'
          : 'border-surface-border text-text-secondary hover:bg-surface-2'
      }`}
    >
      {label}
    </button>
  );
}
