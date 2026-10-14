import { useState } from 'react';
import { Alert, Badge, Button, Card, Code, Group, Select, SimpleGrid, Stack, Text, Timeline } from '@mantine/core';
import { IconCircleCheck, IconCircleDashed, IconDownload, IconEdit, IconFileText, IconSend, IconSignature } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ApiError, isMissingEndpoint } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDate, formatDateTime } from '../../lib/format';
import { toastError, toastSuccess } from '../../lib/notify';
import { AgreementParty, agreementsApi, AgreementStatus, AgreementVersionStatus, type AgreementDetail, type AgreementVersion } from './agreementsApi';
import { AgreementText, TermsSummary } from './AgreementEditorPage';
import { AgreementsSettingUp } from './AgreementsPage';
import { confirmAction, CreatorLine, CREATORS_KEY, ReasonModal } from './components';
import { agreementEventLabel, agreementKindLabel, agreementStatusLook, agreementVersionStatusLook, lookOf, partyLabel } from './labels';

const S = AgreementStatus;

/** The version waiting for signatures (first send or an amendment), if any. */
function pendingVersion(d: AgreementDetail): AgreementVersion | undefined {
  return d.versions.find((v) => v.status === AgreementVersionStatus.PendingAcceptance);
}

function acceptanceOf(v: AgreementVersion | undefined, party: number) {
  return v?.acceptances.find((a) => a.party === party && a.versionNumber === v.versionNumber) ?? v?.acceptances.find((a) => a.party === party);
}

function shortHash(h: string | null | undefined) {
  return h ? `${h.slice(0, 10)}…${h.slice(-6)}` : '—';
}

/** Short device description from a user agent: "Chrome on Android". */
function deviceOf(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /Dart|okhttp|StyleMint/i.test(ua) ? 'StyleMint app' : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null;
  return os ? `${browser} on ${os}` : browser;
}

function Signatures({ d, version }: { d: AgreementDetail; version: AgreementVersion | undefined }) {
  const rows = [
    { party: AgreementParty.Vendor, who: d.vendorName || partyLabel[1] },
    { party: AgreementParty.Creator, who: d.creatorName || partyLabel[2] },
  ];
  return (
    <Stack gap="sm" data-testid="signatures">
      {rows.map((r) => {
        const a = acceptanceOf(version, r.party);
        const signed = !!a || (r.party === AgreementParty.Vendor ? d.vendorAccepted : d.creatorAccepted) === true;
        return (
          <Group key={r.party} justify="space-between" wrap="nowrap" align="flex-start">
            <Group gap="sm" wrap="nowrap" align="flex-start">
              {signed ? <IconCircleCheck size={20} color="var(--mantine-color-forest-6)" /> : <IconCircleDashed size={20} color="var(--sm-text-muted)" />}
              <div>
                <Text size="sm" fw={600}>
                  {r.who}{' '}
                  <Text span size="xs" c="dimmed">
                    ({partyLabel[r.party]})
                  </Text>
                </Text>
                {a ? (
                  <Text size="xs" c="dimmed">
                    Signed {formatDateTime(a.acceptedUtc)}
                    {/* The IP address stays in the audit record; it is not shown to the other party. */}
                    {deviceOf(a.userAgent) ? ` · ${deviceOf(a.userAgent)}` : ''} · terms <Code>{shortHash(a.termsHash)}</Code>
                  </Text>
                ) : (
                  <Text size="xs" c="dimmed">
                    {signed ? 'Signed' : 'Not signed yet'}
                  </Text>
                )}
              </div>
            </Group>
          </Group>
        );
      })}
      {version && (
        <Text size="xs" c="dimmed">
          Version {version.versionNumber} fingerprint (SHA-256): <Code>{version.termsHash || '—'}</Code>
        </Text>
      )}
    </Stack>
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function AgreementDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [CREATORS_KEY, 'agreements', 'one', id], queryFn: () => agreementsApi.get(id!), enabled: !!id });
  const [shownVersion, setShownVersion] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<'terminate' | 'withdraw' | null>(null);

  const refresh = (d?: AgreementDetail) => {
    if (d) qc.setQueryData([CREATORS_KEY, 'agreements', 'one', id], d);
    void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'agreements'] });
  };
  const send = useMutation({
    mutationFn: () => agreementsApi.send(id!),
    onSuccess: (d) => {
      toastSuccess('Sent for signature. The creator is notified.');
      refresh(d);
    },
    onError: (e) => toastError(e, 'Could not send'),
  });
  const sign = useMutation({
    mutationFn: (v: AgreementVersion) => agreementsApi.accept(id!, v.versionNumber, v.termsHash),
    onSuccess: (d) => {
      toastSuccess(d.status === S.Active ? 'Signed. The agreement is now in force.' : 'Signed. Waiting for the creator.');
      refresh(d);
    },
    onError: (e) => {
      // 409 on termsHash / versionNumber: the text changed under us. Show the latest before signing.
      if (e instanceof ApiError && e.status === 409) {
        void q.refetch();
        toastError(new Error('The agreement changed since you opened it. The latest text is shown now — read it before signing.'), 'Not signed');
      } else toastError(e, 'Could not sign');
    },
  });
  const pdf = useMutation({
    mutationFn: (v: number | undefined) => agreementsApi.pdf(id!, v),
    onSuccess: (blob, v) => download(blob, `${q.data?.agreementNumber || 'agreement'}${v ? `-v${v}` : ''}.pdf`),
    onError: (e) => toastError(e, 'Could not download the PDF'),
  });

  if (q.isPending) return <ListSkeleton rows={6} />;
  if (q.error) {
    if (isMissingEndpoint(q.error)) return <AgreementsSettingUp />;
    return <ErrorBlock error={q.error} title="Could not load this agreement" onRetry={() => void q.refetch()} />;
  }
  const d = q.data;
  const pending = pendingVersion(d);
  const vendorSignedPending = pending ? !!acceptanceOf(pending, AgreementParty.Vendor) : true;
  const inForce = d.versions.find((v) => v.versionNumber === d.activeVersion);
  const version = d.versions.find((v) => String(v.versionNumber) === shownVersion) ?? pending ?? inForce ?? d.versions[0];
  const look = lookOf(agreementStatusLook, d.status);
  const ended = d.status === S.Terminated || d.status === S.Expired || d.status === S.Declined || d.status === S.Cancelled;

  const doSend = async () => {
    const ok = await confirmAction({
      title: 'Send for signature?',
      body: `${d.creatorName || 'The creator'} gets the agreement to read and sign. You cannot edit it after sending — changes need an amendment.`,
      confirmLabel: 'Send for signature',
    });
    if (ok) send.mutate();
  };
  const doSign = async (v: AgreementVersion) => {
    const ok = await confirmAction({
      title: `Sign version ${v.versionNumber}?`,
      body: (
        <Stack gap="xs">
          <Text size="sm">
            You agree to these terms on behalf of your shop. Your signature, the time and this device are recorded with the terms fingerprint.
          </Text>
          <Code block>{v.termsHash}</Code>
        </Stack>
      ),
      confirmLabel: 'Sign agreement',
    });
    if (ok) sign.mutate(v);
  };

  return (
    <>
      <PageHeader
        title={d.title}
        back={{ to: '/creators/agreements', label: 'Agreements' }}
        meta={
          <Group gap="xs">
            <StatusBadge {...look} />
            <Text size="sm" c="dimmed">
              {d.agreementNumber} · {agreementKindLabel[d.kind] ?? 'Agreement'} · version {d.currentVersion}
            </Text>
          </Group>
        }
        actions={
          <>
            {d.status === S.Draft && (
              <>
                <Button component={Link} to={`/creators/agreements/${d.id}/edit`} variant="default" leftSection={<IconEdit size={16} />}>
                  Edit
                </Button>
                <Button leftSection={<IconSend size={16} />} loading={send.isPending} onClick={doSend}>
                  Send for signature
                </Button>
              </>
            )}
            {pending && !vendorSignedPending && d.status !== S.Draft && (
              <Button leftSection={<IconSignature size={16} />} loading={sign.isPending} onClick={() => void doSign(pending)}>
                Sign {d.status === S.Amended ? 'amendment' : 'agreement'}
              </Button>
            )}
            {d.status === S.Active && (
              <Button component={Link} to={`/creators/agreements/${d.id}/amend`} variant="default" leftSection={<IconFileText size={16} />}>
                Amend
              </Button>
            )}
            {d.status !== S.Draft && (
              <Button variant="default" leftSection={<IconDownload size={16} />} loading={pdf.isPending} onClick={() => pdf.mutate(version?.versionNumber)}>
                PDF
              </Button>
            )}
          </>
        }
      />
      <Stack gap="lg">
        {d.status === S.Amended && pending && (
          <Alert color="amber" variant="light" title={`Amendment (version ${pending.versionNumber}) waiting for signatures`}>
            Version {d.activeVersion} stays in force until both of you sign. {pending.amendmentReason ? `Reason: ${pending.amendmentReason}` : ''}
          </Alert>
        )}
        {ended && (
          <Alert color={d.status === S.Terminated ? 'signal' : 'gray'} variant="light" title={look.label} data-testid="ended-alert">
            {formatDate(d.endedUtc)}
            {d.endedByParty ? ` by ${partyLabel[d.endedByParty] ?? '—'}` : ''}
            {d.endReason ? ` — ${d.endReason}` : ''}
          </Alert>
        )}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <SectionCard title="Parties">
            <Stack gap="sm">
              <Text size="sm">
                <b>{d.vendorName || 'Your shop'}</b> (the brand) and
              </Text>
              <CreatorLine accountId={d.creatorAccountId} name={d.creatorName} handle={d.creatorHandle} />
              <Text size="xs" c="dimmed">
                {d.effectiveFromUtc ? `In force from ${formatDate(d.effectiveFromUtc)}` : d.activatedUtc ? `In force from ${formatDate(d.activatedUtc)}` : 'Starts when both have signed'}
                {d.expiresAtUtc ? ` until ${formatDate(d.expiresAtUtc)}` : ', no end date'}
              </Text>
              {d.partnershipId && (
                <Button component={Link} to="/creators/partnerships" variant="subtle" size="xs" style={{ alignSelf: 'flex-start' }}>
                  Open partnerships
                </Button>
              )}
            </Stack>
          </SectionCard>
          <SectionCard title="Signatures" description={pending ? `Version ${pending.versionNumber}` : inForce ? `Version ${inForce.versionNumber} in force` : undefined}>
            <Signatures d={d} version={pending ?? inForce ?? d.versions[0]} />
          </SectionCard>
        </SimpleGrid>

        {version?.terms && (
          <SectionCard title="Agreed terms" description={`Version ${version.versionNumber}`}>
            <TermsSummary t={version.terms} />
          </SectionCard>
        )}

        <SectionCard
          title="Agreement text"
          description={
            version
              ? `${version.templateName || 'Creator agreement'}${version.templateVersion ? ` v${version.templateVersion}` : ''}${
                  d.templateReviewedByLegal ? ' · reviewed by a lawyer' : ' · standard StyleMint template, not reviewed by a lawyer'
                }`
              : undefined
          }
          action={
            d.versions.length > 1 ? (
              <Select
                aria-label="Version"
                w={220}
                allowDeselect={false}
                value={String(version?.versionNumber)}
                onChange={setShownVersion}
                data={d.versions.map((v) => ({ value: String(v.versionNumber), label: `Version ${v.versionNumber} · ${lookOf(agreementVersionStatusLook, v.status).label}` }))}
              />
            ) : version ? (
              <Badge variant="light" color={lookOf(agreementVersionStatusLook, version.status).color}>
                {lookOf(agreementVersionStatusLook, version.status).label}
              </Badge>
            ) : null
          }
        >
          {version?.renderedText ? <AgreementText text={version.renderedText} /> : <Text c="dimmed">No text yet.</Text>}
        </SectionCard>

        <SectionCard title="History">
          {d.events.length === 0 ? (
            <Text size="sm" c="dimmed">
              Nothing yet.
            </Text>
          ) : (
            <Timeline bulletSize={14} lineWidth={2} color="forest" data-testid="agreement-timeline">
              {d.events.map((e, i) => (
                <Timeline.Item key={i} title={agreementEventLabel[e.type] ?? 'Update'}>
                  <Text size="xs" c="dimmed">
                    {formatDateTime(e.occurredUtc)} · {partyLabel[e.actorParty] ?? '—'}
                    {e.versionNumber ? ` · version ${e.versionNumber}` : ''}
                  </Text>
                  {e.note && <Text size="sm">{e.note}</Text>}
                </Timeline.Item>
              ))}
            </Timeline>
          )}
        </SectionCard>

        {!ended && (
          <Card>
            <Group justify="space-between" wrap="wrap" gap="sm">
              <Text size="sm" c="dimmed">
                {d.status === S.Active || d.status === S.Amended
                  ? 'Ending the agreement early follows the notice period in the terms.'
                  : 'You can withdraw before the creator signs.'}
              </Text>
              {(d.status === S.Active || d.status === S.Amended) && (
                <Button color="signal" variant="light" onClick={() => setReasonFor('terminate')}>
                  Terminate agreement
                </Button>
              )}
              {(d.status === S.Draft || d.status === S.SentForSignature || d.status === S.PartiallyAccepted || d.status === S.Amended) && (
                <Button color="signal" variant="subtle" onClick={() => setReasonFor('withdraw')}>
                  {d.status === S.Amended ? 'Withdraw amendment' : d.status === S.Draft ? 'Discard draft' : 'Withdraw'}
                </Button>
              )}
            </Group>
          </Card>
        )}
      </Stack>

      <ReasonModal
        opened={reasonFor === 'terminate'}
        onClose={() => setReasonFor(null)}
        title="Terminate agreement"
        intro={`This ends the agreement with ${d.creatorName || 'the creator'} for good. They are notified, and the reason is kept on record.`}
        confirmLabel="Terminate"
        danger
        maxLength={500}
        onConfirm={async (reason) => {
          const r = await agreementsApi.terminate(d.id, reason);
          toastSuccess('Agreement terminated');
          refresh(r);
        }}
      />
      <ReasonModal
        opened={reasonFor === 'withdraw'}
        onClose={() => setReasonFor(null)}
        title={d.status === S.Amended ? 'Withdraw amendment' : d.status === S.Draft ? 'Discard draft' : 'Withdraw agreement'}
        intro={
          d.status === S.Amended
            ? `Version ${d.activeVersion} stays in force. The creator is told the amendment was withdrawn.`
            : d.status === S.Draft
              ? 'The draft is cancelled. The creator never saw it.'
              : 'The creator can no longer sign it. You can write a new one later.'
        }
        required={false}
        label="Reason (optional)"
        confirmLabel={d.status === S.Amended ? 'Withdraw amendment' : d.status === S.Draft ? 'Discard' : 'Withdraw'}
        danger
        onConfirm={async (reason) => {
          const r = await agreementsApi.withdraw(d.id, reason || null);
          toastSuccess('Withdrawn');
          refresh(r);
        }}
      />
    </>
  );
}
