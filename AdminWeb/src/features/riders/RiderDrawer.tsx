import { Alert, Badge, Button, Group, Menu, SimpleGrid, Skeleton, Stack, Table, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconArrowUpRight, IconCertificate, IconChevronDown, IconCoin, IconId, IconPlayerPause, IconPlayerPlay, IconRefresh, IconSchool, IconShieldCheck } from '@tabler/icons-react';
import {
  COURIER_STATE,
  COURIER_TONE,
  couriersApi,
  DEMOTE_REASON,
  DOC_SIDE,
  DOC_STATUS,
  DOC_TYPE,
  ESCROW_KIND,
  ESCROW_STATE,
  SELFIE_DOC_TYPE,
  TIER,
  VEHICLE,
  type CourierDocument,
  type CourierProfile,
} from '@/api/couriers';
import { ApiError } from '@/api/errors';
import { useAuth } from '@/auth/guards';
import { useActionDialog } from '@/components/ActionDialog';
import { FieldGrid, IdText, When, YesNo } from '@/components/Bits';
import { DetailDrawer } from '@/components/DetailDrawer';
import { DocumentGrid, DocumentTile } from '@/components/DocumentViewer';
import { MetricTile } from '@/components/MetricTile';
import { ErrorBlock, SectionCard } from '@/components/StateBlocks';
import { fmtMoney, fmtNumber, fmtPercent, maskEmail, maskPhone } from '@/lib/format';

function docLabel(d: CourierDocument) {
  const side = DOC_SIDE[d.side];
  return `${DOC_TYPE[d.documentType] ?? `Document ${d.documentType}`}${side ? ` - ${side.toLowerCase()}` : ''}`;
}

export function RiderDrawer({ courierId, onClose, onOpenFull }: { courierId: string | null; onClose: () => void; onOpenFull?: (id: string) => void }) {
  const opened = courierId !== null;
  const profile = useQuery({ queryKey: ['couriers', 'profile', courierId], queryFn: ({ signal }) => couriersApi.get(courierId!, signal), enabled: opened });
  const c = profile.data;
  return (
    <DetailDrawer
      opened={opened}
      onClose={onClose}
      title={c ? c.accountDisplayName ?? 'Name unknown' : 'Rider'}
      subtitle={c ? `${TIER[c.currentTier] ?? ''} rider${c.vehicle ? ` · ${VEHICLE[c.vehicle]}` : ''}` : undefined}
      badges={
        c && (
          <>
            <Badge variant="light" color={COURIER_TONE[c.state]}>
              {COURIER_STATE[c.state]}
            </Badge>
            <Badge variant="dot" color={c.isOnline ? 'forest' : 'gray'}>
              {c.isOnline ? 'Online' : 'Offline'}
            </Badge>
          </>
        )
      }
    >
      {profile.error ? (
        <ErrorBlock error={profile.error} onRetry={() => void profile.refetch()} />
      ) : !c ? (
        <Stack>
          <Skeleton height={120} radius="lg" />
          <Skeleton height={220} radius="lg" />
        </Stack>
      ) : (
        <RiderCase courier={c} onOpenFull={onOpenFull} />
      )}
    </DetailDrawer>
  );
}

function RiderCase({ courier: c, onOpenFull }: { courier: CourierProfile; onOpenFull?: (id: string) => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const docs = useQuery({
    queryKey: ['couriers', 'docs', c.id],
    queryFn: ({ signal }) => couriersApi.documents(c.id, signal).catch((e) => (e instanceof ApiError && e.isNotFound ? [] : Promise.reject(e))),
  });
  const reliability = useQuery({
    queryKey: ['couriers', 'reliability', c.id],
    queryFn: ({ signal }) => couriersApi.reliability(c.id, signal).catch((e) => (e instanceof ApiError && e.isNotFound ? null : Promise.reject(e))),
  });
  const escrow = useQuery({ queryKey: ['couriers', 'escrow', c.id], queryFn: ({ signal }) => couriersApi.escrow(c.id, signal) });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['couriers'] });
  const selfie = docs.data?.find((d) => d.documentType === SELFIE_DOC_TYPE);
  const inKyc = c.state === 1 || c.state === 2;

  const approveKyc = () =>
    open({
      title: `Approve ${c.accountDisplayName ?? 'this rider'}’s identity`,
      consequence: 'They become Onboarded as a Neighbour rider. Type the last four digits of the government ID exactly as printed on the document.',
      confirmLabel: 'Approve identity',
      fields: [{ name: 'last4', kind: 'text', label: 'Last 4 digits of the ID', required: true, placeholder: '1234', minLength: 4 }],
      run: (v) => {
        const last4 = v.last4!.replace(/\D/g, '');
        if (last4.length !== 4) return Promise.reject(new ApiError({ status: 400, message: 'Enter exactly four digits.' }));
        if (!selfie) return Promise.reject(new ApiError({ status: 400, message: 'There is no selfie on file to match against. Reject with a reason instead.' }));
        return couriersApi.completeKyc(c.id, { approved: true, governmentIdLast4: last4, selfieMatchRef: selfie.id, rejectionReason: null });
      },
      success: 'Identity approved - rider onboarded.',
      onDone: refresh,
    });

  const rejectKyc = () =>
    open({
      title: 'Reject the identity check',
      consequence: 'The rider is told their identity could not be verified, with your reason.',
      confirmLabel: 'Reject identity',
      danger: true,
      fields: [{ name: 'reason', kind: 'textarea', label: 'Reason (shown to the rider)', required: true, minLength: 5 }],
      run: (v) => couriersApi.completeKyc(c.id, { approved: false, governmentIdLast4: '', selfieMatchRef: '', rejectionReason: v.reason!.trim() }),
      success: 'Identity rejected.',
      onDone: refresh,
    });

  const simple = (title: string, consequence: string, confirmLabel: string, run: () => Promise<unknown>, success: string, danger = false) =>
    open({ title, consequence, confirmLabel, danger, run: () => run(), success, onDone: refresh });

  return (
    <Stack gap="lg">
      {dialog}
      <Group gap="sm" wrap="wrap">
        {can('manageRiders') && inKyc && (
          <>
            <Button size="sm" leftSection={<IconShieldCheck size={16} />} onClick={approveKyc} disabled={docs.isLoading}>
              Approve identity
            </Button>
            <Button size="sm" variant="light" color="signal" onClick={rejectKyc}>
              Reject identity
            </Button>
          </>
        )}
        {can('manageRiders') && !c.backgroundCheckPassedUtc && (
          <Button
            size="sm"
            variant="default"
            leftSection={<IconCertificate size={16} />}
            onClick={() => simple('Record a passed background check', 'Stamps today as the date the background check passed. Needed for Pro.', 'Record pass', () => couriersApi.backgroundCheckPass(c.id), 'Background check recorded.')}
          >
            Background check passed
          </Button>
        )}
        {can('manageRiders') && !c.trainingPassedUtc && (
          <Button
            size="sm"
            variant="default"
            leftSection={<IconSchool size={16} />}
            onClick={() => simple('Record completed training', 'Stamps today as the date training was passed. Needed for Pro.', 'Record training', () => couriersApi.trainingPass(c.id), 'Training recorded.')}
          >
            Training passed
          </Button>
        )}
        {(can('promoteRiders') || can('suspendRiders') || can('riderEscrow') || can('recomputeReliability')) && (
          <Menu position="bottom-end">
            <Menu.Target>
              <Button size="sm" variant="default" rightSection={<IconChevronDown size={14} />}>
                More actions
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {can('promoteRiders') && c.currentTier === 1 && (
                <Menu.Item
                  leftSection={<IconArrowUpRight size={15} />}
                  onClick={() => simple('Promote to Traveller', 'Traveller riders take longer, multi-locality hops. The server checks reliability, KYC and escrow first.', 'Promote', () => couriersApi.promoteTraveler(c.id), 'Promoted to Traveller.')}
                >
                  Promote to Traveller
                </Menu.Item>
              )}
              {can('promoteRiders') && c.currentTier === 2 && (
                <Menu.Item
                  leftSection={<IconArrowUpRight size={15} />}
                  onClick={() => simple('Promote to Pro', 'Pro needs a passed background check, training and the escrow minimum; the server checks.', 'Promote', () => couriersApi.promotePro(c.id), 'Promoted to Pro.')}
                >
                  Promote to Pro
                </Menu.Item>
              )}
              {can('recomputeReliability') && (
                <Menu.Item
                  leftSection={<IconRefresh size={15} />}
                  onClick={() => simple('Recompute reliability', 'Recalculates the reliability score from recent hops now, instead of waiting for the nightly run.', 'Recompute', () => couriersApi.recomputeReliability(c.id), 'Reliability recomputed.')}
                >
                  Recompute reliability
                </Menu.Item>
              )}
              {can('riderEscrow') && (
                <>
                  <Menu.Item
                    leftSection={<IconCoin size={15} />}
                    onClick={() =>
                      open({
                        title: 'Record an escrow deposit',
                        consequence: 'Adds money the rider has deposited to their held escrow.',
                        confirmLabel: 'Record deposit',
                        fields: [
                          { name: 'amount', kind: 'number', label: `Amount (${c.escrowCurrency || 'NPR'})`, required: true, min: 1, max: 1_000_000, decimalScale: 2 },
                          { name: 'note', kind: 'textarea', label: 'Note (receipt or reference)' },
                        ],
                        run: (v) => couriersApi.escrowDeposit(c.id, { amount: Number(v.amount), currency: c.escrowCurrency || 'NPR', note: v.note?.trim() || null }),
                        success: 'Deposit recorded.',
                        onDone: refresh,
                      })
                    }
                  >
                    Record escrow deposit
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconCoin size={15} />}
                    onClick={() =>
                      open({
                        title: 'Draw from escrow for a claim',
                        consequence: 'Takes money from the rider’s escrow to cover a claim (for example a damaged parcel). The rider sees the draw.',
                        confirmLabel: 'Draw',
                        danger: true,
                        fields: [
                          { name: 'amount', kind: 'number', label: `Amount (${c.escrowCurrency || 'NPR'})`, required: true, min: 1, max: 1_000_000, decimalScale: 2 },
                          { name: 'packageId', kind: 'text', label: 'Package ID (if the claim is about a parcel)' },
                          { name: 'note', kind: 'textarea', label: 'Reason', required: true, minLength: 5 },
                        ],
                        run: (v) => couriersApi.escrowDraw(c.id, { amount: Number(v.amount), currency: c.escrowCurrency || 'NPR', packageId: v.packageId?.trim() || null, note: v.note!.trim() }),
                        success: 'Escrow drawn.',
                        onDone: refresh,
                      })
                    }
                  >
                    Draw from escrow
                  </Menu.Item>
                </>
              )}
              {can('suspendRiders') && c.state !== 6 && c.state !== 7 && (
                <Menu.Item
                  color="signal"
                  leftSection={<IconPlayerPause size={15} />}
                  onClick={() =>
                    open({
                      title: `Suspend ${c.accountDisplayName ?? 'this rider'}`,
                      consequence: 'They are taken offline at once and receive no new delivery offers until reinstated.',
                      confirmLabel: 'Suspend rider',
                      danger: true,
                      fields: [{ name: 'reason', kind: 'textarea', label: 'Reason', required: true, minLength: 5 }],
                      run: (v) => couriersApi.suspend(c.id, v.reason!.trim()),
                      success: 'Rider suspended.',
                      onDone: refresh,
                    })
                  }
                >
                  Suspend
                </Menu.Item>
              )}
              {can('suspendRiders') && (c.state === 6 || c.state === 4) && (
                <Menu.Item
                  leftSection={<IconPlayerPlay size={15} />}
                  onClick={() => simple('Reinstate the rider', 'They become Active and can receive delivery offers again.', 'Reinstate', () => couriersApi.reinstate(c.id), 'Rider reinstated.')}
                >
                  {c.state === 6 ? 'Reinstate' : 'Activate'}
                </Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
        )}
        {onOpenFull && (
          <Button size="sm" variant="subtle" onClick={() => onOpenFull(c.id)}>
            Open in Riders
          </Button>
        )}
      </Group>

      {c.state === 6 && c.suspendedReason && (
        <Alert color="signal" variant="light" title="Suspended">
          {c.suspendedReason} {c.suspendedUtc && <>· <When value={c.suspendedUtc} /></>}
        </Alert>
      )}
      {c.state === 3 && c.suspendedReason && (
        <Alert color="signal" variant="light" title="Identity rejected">
          {c.suspendedReason}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
        <MetricTile label="Reliability" value={reliability.data ? fmtNumber(reliability.data.reliabilityScore * (reliability.data.reliabilityScore <= 1 ? 100 : 1), 0) : c.reliabilityScore !== null ? fmtNumber(c.reliabilityScore * (c.reliabilityScore <= 1 ? 100 : 1), 0) : '—'} loading={reliability.isLoading} tone="forest" />
        <MetricTile label="Rating" value={c.averageCustomerRating ? `${c.averageCustomerRating.toFixed(1)} ★` : '—'} tone="amber" />
        <MetricTile label="On time" value={reliability.data ? fmtPercent(reliability.data.onTimeRate, 0, { fraction: reliability.data.onTimeRate <= 1 }) : '—'} loading={reliability.isLoading} tone="forest" />
        <MetricTile
          label="Escrow held"
          value={fmtMoney(c.escrowHeldAmount, c.escrowCurrency)}
          hint={`Required ${fmtMoney(c.escrowRequiredAmount, c.escrowCurrency)}`}
          tone={c.escrowHeldAmount < c.escrowRequiredAmount ? 'signal' : 'gray'}
        />
      </SimpleGrid>

      <SectionCard title="Profile">
        <FieldGrid
          cols={3}
          fields={[
            { label: 'Email', value: c.accountEmail ? `${maskEmail(c.accountEmail)}${c.accountEmailVerified === false ? ' (unverified)' : ''}` : null },
            { label: 'Phone', value: c.accountPhone ? maskPhone(c.accountPhone) : null },
            { label: 'Government ID', value: c.governmentIdLast4 ? <span className="sm-mono">•••• {c.governmentIdLast4}</span> : null },
            { label: 'Identity verified', value: <When value={c.kycVerifiedUtc} /> },
            { label: 'Background check', value: <When value={c.backgroundCheckPassedUtc} /> },
            { label: 'Training', value: <When value={c.trainingPassedUtc} /> },
            { label: 'Onboarded', value: <When value={c.onboardedUtc} /> },
            { label: 'Failure streak', value: String(c.failureStreak) },
            { label: 'Last demotion', value: c.lastDemoteReason ? DEMOTE_REASON[c.lastDemoteReason] : null },
            { label: 'Home area', value: <span className="sm-mono">{c.homeGeohashPrefix5}</span> },
            { label: 'Online', value: <YesNo value={c.isOnline} /> },
            { label: 'Last location', value: c.lastLocationUtc ? <When value={c.lastLocationUtc} relative /> : null },
            { label: 'Rider ID', value: <IdText value={c.id} /> },
            { label: 'Account', value: <IdText value={c.accountId} /> },
            { label: 'Applied', value: <When value={c.createdUtc} /> },
          ]}
        />
      </SectionCard>

      <SectionCard title="Identity documents" description="Files open only when asked for.">
        {docs.error ? (
          <ErrorBlock error={docs.error} onRetry={() => void docs.refetch()} />
        ) : docs.isLoading ? (
          <Skeleton height={120} radius="md" />
        ) : !docs.data || docs.data.length === 0 ? (
          <Group gap="xs">
            <IconId size={18} opacity={0.6} aria-hidden />
            <Text size="sm" c="dimmed">
              No documents uploaded.
            </Text>
          </Group>
        ) : (
          <DocumentGrid>
            {docs.data.map((d) => (
              <DocumentTile
                key={d.id}
                doc={{
                  id: d.id,
                  label: docLabel(d),
                  status: DOC_STATUS[d.status],
                  contentType: d.contentType,
                  sizeBytes: d.contentSizeBytes,
                  uploadedUtc: d.uploadedUtc,
                  filename: d.originalFilename,
                  rejectionReason: d.rejectionReason,
                  emphasis: d.documentType === SELFIE_DOC_TYPE,
                }}
                queryKey={['couriers', 'doc-link', c.id, d.id]}
                fetchLink={(signal) => couriersApi.documentLink(c.id, d.id, signal)}
              />
            ))}
          </DocumentGrid>
        )}
      </SectionCard>

      <SectionCard title="Escrow ledger">
        {escrow.error ? (
          <ErrorBlock error={escrow.error} onRetry={() => void escrow.refetch()} />
        ) : escrow.isLoading ? (
          <Skeleton height={80} radius="md" />
        ) : !escrow.data || escrow.data.length === 0 ? (
          <Text size="sm" c="dimmed">
            No escrow movements.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={480}>
            <Table aria-label="Escrow movements">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>When</Table.Th>
                  <Table.Th>Kind</Table.Th>
                  <Table.Th>State</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Amount</Table.Th>
                  <Table.Th>Note</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {escrow.data.map((e) => (
                  <Table.Tr key={e.id}>
                    <Table.Td>
                      <When value={e.occurredUtc} />
                    </Table.Td>
                    <Table.Td>{ESCROW_KIND[e.kind] ?? e.kind}</Table.Td>
                    <Table.Td>{ESCROW_STATE[e.state] ?? e.state}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{fmtMoney(e.amount, e.currency)}</Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={2}>
                        {e.note ?? '—'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </SectionCard>
    </Stack>
  );
}
