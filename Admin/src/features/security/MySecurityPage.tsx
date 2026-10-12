import { useMeMfa, useMeSessions, type AdminSession } from '@/api/queries/useMe';
import { DataTable, type Column } from '@/components/DataTable';
import { ListState } from '@/components/ListState';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/auth/store';
import { utcDate } from '@/lib/dates';

/**
 * The operator's own security posture: whether MFA is set up, whether
 * their step-up is still fresh, and every session their account has
 * open.
 *
 * The session list is the useful half. An operator who sees a session
 * they do not recognise needs to notice it, so "this browser" is
 * marked explicitly rather than left to be inferred from a timestamp.
 */
export function MySecurityPage() {
  const mfa = useMeMfa();
  const sessions = useMeSessions();
  const claims = useAuth((s) => s.claims);
  const rows = sessions.data ?? [];

  const columns: Column<AdminSession>[] = [
    {
      header: 'Session',
      cell: (r) =>
        r.jti === claims?.jti ? (
          <span className="font-semibold text-primary">This browser</span>
        ) : (
          <span className="text-text-secondary">{r.sourceIp ?? 'Unknown origin'}</span>
        ),
    },
    { header: 'Agent', cell: (r) => shorten(r.userAgent) },
    { header: 'Started', cell: (r) => utcDate(r.issuedUtc) },
    { header: 'Last seen', cell: (r) => utcDate(r.lastSeenUtc) },
    {
      header: 'State',
      cell: (r) => (r.revokedUtc ? 'Revoked' : 'Active'),
      align: 'right',
    },
  ];

  return (
    <section className="space-y-6">
      <PageHeader title="My security" />

      <div className="rounded-xl border border-surface-border bg-bg-card p-5">
        <h2 className="text-sm font-bold text-text-primary">Two-factor authentication</h2>
        {mfa.isError ? (
          <p className="mt-2 text-xs text-text-secondary">
            Could not read your MFA status. This does not mean it is off.
          </p>
        ) : mfa.isPending ? (
          <p className="mt-2 text-xs text-text-muted">Checking…</p>
        ) : (
          <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
            <Row label="Authenticator app" value={mfa.data?.totpConfirmed ? 'Set up' : 'Not set up'} />
            <Row label="Locked out" value={mfa.data?.totpLocked ? 'Yes' : 'No'} />
            <Row label="Last verified" value={utcDate(mfa.data?.totpLastVerifiedUtc)} />
            <Row
              label="Step-up still fresh"
              value={
                mfa.data?.sessionStepUpFresh
                  ? `Yes, for ${mfa.data.stepUpMaxAgeMinutes} minutes from last check`
                  : 'No — the next sensitive action will ask again'
              }
            />
          </dl>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border bg-bg-card">
        <h2 className="border-b border-surface-border px-5 py-3 text-sm font-bold text-text-primary">
          Active sessions
        </h2>
        <ListState
          query={sessions}
          isEmpty={rows.length === 0}
          noun="sessions"
          emptyTitle="No sessions recorded."
        >
          <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} />
        </ListState>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-text-secondary">{value}</dd>
    </>
  );
}

/** A user-agent string in a table cell is noise past the browser name. */
function shorten(agent: string | null): string {
  if (!agent) return '—';
  const match = /(Chrome|Firefox|Safari|Edg)\/[\d.]+/.exec(agent);
  return match ? match[0].replace('Edg', 'Edge') : `${agent.slice(0, 28)}…`;
}
