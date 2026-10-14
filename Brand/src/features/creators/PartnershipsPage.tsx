import { useState } from 'react';
import {
  Alert,
  Anchor,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
} from '@mantine/core';
import { IconFileText, IconUserPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { isMissingEndpoint, messageOf } from '../../api/client';
import { useCursorList } from '../../api/useCursorList';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '../../lib/format';
import { toastError, toastSuccess } from '../../lib/notify';
import { useIsPhone } from '../../lib/useIsPhone';
import { creatorsApi, PartnershipState, type Partnership } from './api';
import { confirmAction, CreatorLine, CREATORS_KEY, DetailSheet, InviteModal, ProgramTermsModal, ReasonModal } from './components';
import { claimStateLook, commissionRange, insuranceStateLook, lookOf, partnershipStateLook, pct, toFraction } from './labels';

type Filter = 'requests' | 'invited' | 'active' | 'paused' | 'ended' | 'all';

const FILTERS: { value: Filter; label: string; states?: number[] }[] = [
  { value: 'requests', label: 'Requests', states: [PartnershipState.Invited] },
  { value: 'invited', label: 'Invited', states: [PartnershipState.Invited] },
  { value: 'active', label: 'Active', states: [PartnershipState.Active] },
  { value: 'paused', label: 'Paused', states: [PartnershipState.Paused] },
  { value: 'ended', label: 'Ended', states: [PartnershipState.Ended, PartnershipState.Declined] },
  { value: 'all', label: 'All' },
];

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'partnerships'] });
}

/** Prediction for a live partnership. Hidden when the model has nothing (404). */
function PredictionBlock({ id }: { id: string }) {
  const q = useQuery({ queryKey: [CREATORS_KEY, 'predict', id], queryFn: () => creatorsApi.predict(id), retry: false });
  if (q.isPending) return <Text size="sm" c="dimmed">Loading forecast…</Text>;
  if (q.error) return isMissingEndpoint(q.error) || (q.error as { status?: number }).status === 404 ? null : <Text size="sm" c="dimmed">Forecast not available.</Text>;
  const p = q.data;
  return (
    <Stack gap={6} data-testid="prediction">
      <Divider label="Forecast" labelPosition="left" />
      <SimpleGrid cols={3} spacing="xs">
        <Text size="sm">
          <b>{formatNumber(p.predictedViews)}</b> views
        </Text>
        <Text size="sm">
          <b>{formatNumber(p.predictedSales)}</b> sales
        </Text>
        <Text size="sm">
          <b>{formatMoney({ amount: p.predictedRevenue, currency: p.predictedRevenueCurrency })}</b>
        </Text>
      </SimpleGrid>
      <Text size="xs" c="dimmed">
        {p.confidenceLevel} confidence · suggested commission {pct(p.recommendedCommission)} for {p.recommendedDuration} days
      </Text>
      {p.riskFactors.length > 0 && (
        <Text size="xs" c="dimmed">
          Risks: {p.riskFactors.join('; ')}
        </Text>
      )}
    </Stack>
  );
}

function InsuranceBlock({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [CREATORS_KEY, 'insurance', id], queryFn: () => creatorsApi.insurance(id), retry: false });
  const claims = useQuery({
    queryKey: [CREATORS_KEY, 'insurance-claims', id],
    queryFn: () => creatorsApi.insuranceClaims(id),
    enabled: !!q.data,
    retry: false,
  });
  const [buying, setBuying] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [amount, setAmount] = useState(10000);
  const [reason, setReason] = useState('');
  const buy = useMutation({
    mutationFn: () => creatorsApi.buyInsurance(id, amount),
    onSuccess: () => {
      toastSuccess('Campaign insurance bought');
      setBuying(false);
      void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'insurance', id] });
    },
    onError: (e) => toastError(e),
  });
  const claim = useMutation({
    mutationFn: () => creatorsApi.fileClaim(id, { claimAmount: amount, reason: reason.trim() }),
    onSuccess: () => {
      toastSuccess('Claim filed. StyleMint reviews it.');
      setClaiming(false);
      void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'insurance-claims', id] });
    },
    onError: (e) => toastError(e),
  });
  const missing = q.error && (isMissingEndpoint(q.error) || (q.error as { status?: number }).status === 404);
  if (q.isPending) return null;
  if (q.error && !missing) return null;
  const ins = q.data ?? null;
  return (
    <Stack gap={6}>
      <Divider label="Campaign insurance" labelPosition="left" />
      {ins ? (
        <>
          <Group justify="space-between">
            <Text size="sm">
              {ins.insurerName} · {formatMoney({ amount: ins.coverageAmount, currency: ins.coverageCurrency })} cover until{' '}
              {formatDate(ins.coverageEndUtc)}
            </Text>
            <StatusBadge {...lookOf(insuranceStateLook, ins.state)} />
          </Group>
          {(claims.data ?? []).map((c) => (
            <Group key={c.id} justify="space-between" wrap="nowrap">
              <Text size="xs">
                Claim {formatMoney({ amount: c.claimAmount, currency: c.currency })} · {c.reason}
              </Text>
              <StatusBadge size="sm" {...lookOf(claimStateLook, c.state)} />
            </Group>
          ))}
          {ins.state === 1 && (
            <Button size="xs" variant="default" onClick={() => setClaiming(true)} style={{ alignSelf: 'flex-start' }}>
              File a claim
            </Button>
          )}
        </>
      ) : (
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Not insured. Insurance covers a campaign that the creator does not deliver.
          </Text>
          <Button size="xs" variant="default" onClick={() => setBuying(true)}>
            Buy cover
          </Button>
        </Group>
      )}
      <Modal opened={buying} onClose={() => setBuying(false)} title="Buy campaign insurance" zIndex={400}>
        <Stack>
          <NumberInput label="Cover amount (Rs)" min={1000} thousandSeparator="," value={amount} onChange={(v) => setAmount(Number(v) || 0)} />
          <Text size="xs" c="dimmed">
            The premium is charged to your shop. You will see the policy once it is issued.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setBuying(false)}>
              Cancel
            </Button>
            <Button loading={buy.isPending} onClick={() => buy.mutate()} disabled={amount <= 0}>
              Buy cover
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal opened={claiming} onClose={() => setClaiming(false)} title="File an insurance claim" zIndex={400}>
        <Stack>
          <NumberInput label="Claim amount (Rs)" min={1} thousandSeparator="," value={amount} onChange={(v) => setAmount(Number(v) || 0)} />
          <Textarea label="What went wrong" minRows={3} autosize value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setClaiming(false)}>
              Cancel
            </Button>
            <Button loading={claim.isPending} disabled={!reason.trim() || amount <= 0} onClick={() => claim.mutate()}>
              File claim
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function AdjustCommissionModal({ p, onClose }: { p: Partnership; onClose: () => void }) {
  const qc = useQueryClient();
  const [min, setMin] = useState(Math.round(p.commissionMinPercent * 1000) / 10);
  const [max, setMax] = useState(Math.round(p.commissionMaxPercent * 1000) / 10);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      creatorsApi.adjustCommission(p.id, { commissionMinPercent: toFraction(min), commissionMaxPercent: toFraction(max), reason: reason.trim() || null }),
    onSuccess: () => {
      toastSuccess('Commission updated. The creator is notified.');
      invalidate(qc);
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });
  return (
    <Modal opened onClose={onClose} title="Change commission" zIndex={400}>
      <Stack>
        {error && (
          <Alert color="signal" variant="light" role="alert">
            {error}
          </Alert>
        )}
        <SimpleGrid cols={2}>
          <NumberInput label="Lowest (%)" min={0} max={100} decimalScale={1} value={min} onChange={(v) => setMin(Number(v) || 0)} />
          <NumberInput label="Highest (%)" min={0} max={100} decimalScale={1} value={max} onChange={(v) => setMax(Number(v) || 0)} />
        </SimpleGrid>
        <Textarea label="Note for the creator (optional)" maxLength={200} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            onClick={async () => {
              if (max < min) return setError('The highest commission cannot be lower than the lowest.');
              const ok = await confirmAction({
                title: 'Change the commission?',
                body: `New range: ${commissionRange(toFraction(min), toFraction(max))}. It applies to new sales from now on.`,
                confirmLabel: 'Change commission',
              });
              if (ok) save.mutate();
            }}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function PartnershipDetail({ p, onDone }: { p: Partnership; onDone: () => void }) {
  const qc = useQueryClient();
  const [reasonFor, setReasonFor] = useState<'pause' | 'end' | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => invalidate(qc),
    onError: (e) => toastError(e),
  });
  const look = lookOf(partnershipStateLook, p.state);
  const isRequest = p.state === PartnershipState.Invited && p.initiatedByCreator;

  const accept = async () => {
    const ok = await confirmAction({
      title: 'Accept this partnership?',
      body: `${p.creatorName ?? 'The creator'} can start tagging your products and earn ${commissionRange(p.commissionMinPercent, p.commissionMaxPercent)} on sales.`,
      confirmLabel: 'Accept',
    });
    if (ok)
      run.mutate(() => creatorsApi.acceptRequest(p.id), {
        onSuccess: () => {
          toastSuccess('Partnership accepted');
          onDone();
        },
      });
  };
  const decline = async () => {
    const ok = await confirmAction({ title: 'Decline this request?', body: 'The creator is told you declined.', confirmLabel: 'Decline', danger: true });
    if (ok)
      run.mutate(() => creatorsApi.declineRequest(p.id), {
        onSuccess: () => {
          toastSuccess('Request declined');
          onDone();
        },
      });
  };
  const resume = async () => {
    const ok = await confirmAction({ title: 'Resume this partnership?', body: 'The creator can tag your products again.', confirmLabel: 'Resume' });
    if (ok) run.mutate(() => creatorsApi.resume(p.id), { onSuccess: () => toastSuccess('Partnership resumed') });
  };

  return (
    <Stack gap="md" data-testid="partnership-detail">
      <Group justify="space-between" wrap="nowrap">
        <CreatorLine accountId={p.creatorAccountId ?? p.creatorProfileId} name={p.creatorName} handle={p.creatorHandle} avatarUrl={p.creatorLogoUrl} size={44} />
        <StatusBadge {...look} />
      </Group>
      <SimpleGrid cols={2} spacing="xs">
        <div>
          <Text size="xs" c="dimmed">
            Commission
          </Text>
          <Text fw={650}>{commissionRange(p.commissionMinPercent, p.commissionMaxPercent)}</Text>
        </div>
        <div>
          <Text size="xs" c="dimmed">
            {p.initiatedByCreator ? 'Requested' : 'Invited'}
          </Text>
          <Text>{formatDate(p.invitedUtc)}</Text>
        </div>
        {p.respondedUtc && (
          <div>
            <Text size="xs" c="dimmed">
              Answered
            </Text>
            <Text>{formatDate(p.respondedUtc)}</Text>
          </div>
        )}
        {p.endedUtc && (
          <div>
            <Text size="xs" c="dimmed">
              Ended
            </Text>
            <Text>{formatDate(p.endedUtc)}</Text>
          </div>
        )}
      </SimpleGrid>
      {p.requestMessage && (
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">
            Message from the creator
          </Text>
          <Text size="sm">{p.requestMessage}</Text>
        </Card>
      )}
      {p.endReason && (
        <Text size="sm" c="dimmed">
          Reason: {p.endReason}
        </Text>
      )}
      {p.brandBriefId && (
        <Text size="sm">
          Under brief <Anchor component={Link} to={`/creators/campaigns?brief=${p.brandBriefId}`}>v{p.brandBriefVersion ?? 1}</Anchor>
        </Text>
      )}

      <Group gap="xs">
        {isRequest && (
          <>
            <Button onClick={accept} loading={run.isPending}>
              Accept request
            </Button>
            <Button variant="default" color="signal" onClick={decline} disabled={run.isPending}>
              Decline
            </Button>
          </>
        )}
        {p.state === PartnershipState.Invited && !p.initiatedByCreator && (
          <Text size="sm" c="dimmed">
            Waiting for the creator to answer.
          </Text>
        )}
        {p.state === PartnershipState.Active && (
          <>
            <Button variant="default" onClick={() => setAdjusting(true)}>
              Change commission
            </Button>
            <Button variant="default" onClick={() => setReasonFor('pause')}>
              Pause
            </Button>
          </>
        )}
        {p.state === PartnershipState.Paused && (
          <Button variant="default" onClick={resume} loading={run.isPending}>
            Resume
          </Button>
        )}
        {(p.state === PartnershipState.Active || p.state === PartnershipState.Paused) && (
          <Button variant="light" color="signal" onClick={() => setReasonFor('end')}>
            End partnership
          </Button>
        )}
      </Group>

      {(p.state === PartnershipState.Active || p.state === PartnershipState.Paused || p.state === PartnershipState.Invited) && (
        <Group gap="xs">
          <Button
            component={Link}
            to={`/creators/agreements/new?kind=1&partnershipId=${p.id}`}
            variant="light"
            leftSection={<IconFileText size={16} />}
          >
            Write agreement
          </Button>
          <Button component={Link} to={`/creators/agreements?partnershipId=${p.id}`} variant="subtle">
            See agreements
          </Button>
        </Group>
      )}
      <Anchor component={Link} to="/insights/creators" size="sm">
        Sales from creators in Insights
      </Anchor>

      {(p.state === PartnershipState.Active || p.state === PartnershipState.Paused) && (
        <>
          <PredictionBlock id={p.id} />
          <InsuranceBlock id={p.id} />
        </>
      )}

      <ReasonModal
        opened={reasonFor === 'pause'}
        onClose={() => setReasonFor(null)}
        title="Pause partnership"
        intro="While paused the creator cannot tag your products in new reels. You can resume any time."
        required={false}
        label="Reason (optional, the creator sees it)"
        confirmLabel="Pause"
        onConfirm={async (reason) => {
          await creatorsApi.pause(p.id, reason || null);
          toastSuccess('Partnership paused');
          invalidate(qc);
        }}
      />
      <ReasonModal
        opened={reasonFor === 'end'}
        onClose={() => setReasonFor(null)}
        title="End partnership"
        intro="Ending is permanent. The creator stops earning commission on new sales; sales already made still pay out."
        confirmLabel="End partnership"
        danger
        onConfirm={async (reason) => {
          await creatorsApi.end(p.id, reason);
          toastSuccess('Partnership ended');
          invalidate(qc);
          onDone();
        }}
      />
      {adjusting && <AdjustCommissionModal p={p} onClose={() => setAdjusting(false)} />}
    </Stack>
  );
}

export default function PartnershipsPage() {
  const phone = useIsPhone();
  const [filter, setFilter] = useState<Filter>('active');
  const [openId, setOpenId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [editingTerms, setEditingTerms] = useState(false);
  const def = FILTERS.find((f) => f.value === filter)!;
  const list = useCursorList({
    key: [CREATORS_KEY, 'partnerships'],
    resetKey: filter,
    fetchPage: (cursor) => creatorsApi.partnerships(def.states, cursor),
  });
  let items = list.query.data?.items ?? [];
  if (filter === 'requests') items = items.filter((p) => p.initiatedByCreator);
  if (filter === 'invited') items = items.filter((p) => !p.initiatedByCreator);
  const open = list.query.data?.items.find((p) => p.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Partnerships"
        description="Creators who promote your products for a commission. Answer requests, invite new creators and manage live partnerships."
        actions={
          <>
            <Button variant="default" onClick={() => setEditingTerms(true)}>
              Program terms
            </Button>
            <Button leftSection={<IconUserPlus size={16} />} onClick={() => setInviting(true)}>
              Invite a creator
            </Button>
          </>
        }
      />
      <Card>
        <Stack gap="md">
          <SegmentedControl
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            data={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
            fullWidth={phone}
            orientation={phone ? 'vertical' : 'horizontal'}
            aria-label="Partnership status"
          />
          {list.query.isPending ? (
            <ListSkeleton />
          ) : list.query.error ? (
            <ErrorBlock error={list.query.error} title="Could not load partnerships" onRetry={() => void list.query.refetch()} />
          ) : items.length === 0 ? (
            <EmptyBlock
              title={filter === 'requests' ? 'No requests waiting' : 'No partnerships here'}
              body={filter === 'active' ? 'Invite creators from Find creators, or accept a creator’s request.' : undefined}
            />
          ) : phone ? (
            <Stack gap="sm" data-testid="partnership-cards">
              {items.map((p) => (
                <Card key={p.id} withBorder padding="sm" onClick={() => setOpenId(p.id)} style={{ cursor: 'pointer' }}>
                  <Group justify="space-between" wrap="nowrap">
                    <CreatorLine accountId={p.creatorAccountId ?? p.creatorProfileId} name={p.creatorName} handle={p.creatorHandle} avatarUrl={p.creatorLogoUrl} />
                    <StatusBadge {...lookOf(partnershipStateLook, p.state)} />
                  </Group>
                  <Text size="xs" c="dimmed" mt={6}>
                    {commissionRange(p.commissionMinPercent, p.commissionMaxPercent)} · {p.initiatedByCreator ? 'requested' : 'invited'}{' '}
                    {formatDate(p.invitedUtc)}
                  </Text>
                </Card>
              ))}
            </Stack>
          ) : (
            <Table.ScrollContainer minWidth={640}>
              <Table highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Creator</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Commission</Table.Th>
                    <Table.Th>Started</Table.Th>
                    <Table.Th>Updated</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.map((p) => (
                    <Table.Tr key={p.id} onClick={() => setOpenId(p.id)} style={{ cursor: 'pointer' }}>
                      <Table.Td>
                        <CreatorLine accountId={p.creatorAccountId ?? p.creatorProfileId} name={p.creatorName} handle={p.creatorHandle} avatarUrl={p.creatorLogoUrl} />
                      </Table.Td>
                      <Table.Td>
                        <StatusBadge {...lookOf(partnershipStateLook, p.state)} />
                        {p.state === PartnershipState.Invited && p.initiatedByCreator && (
                          <Text size="xs" c="amber.8">
                            Waiting for you
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>{commissionRange(p.commissionMinPercent, p.commissionMaxPercent)}</Table.Td>
                      <Table.Td>{formatDate(p.respondedUtc ?? p.invitedUtc)}</Table.Td>
                      <Table.Td>{formatDateTime(p.updatedUtc)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
          {list.query.data && (
            <Pager
              page={list.page}
              pageSize={list.pageSize}
              total={list.total}
              shown={list.query.data.items.length}
              hasPrev={list.hasPrev}
              hasNext={list.hasNext}
              onPrev={list.prev}
              onNext={list.next}
              busy={list.query.isFetching}
            />
          )}
        </Stack>
      </Card>
      <DetailSheet opened={!!open} onClose={() => setOpenId(null)} title="Partnership">
        {open && <PartnershipDetail p={open} onDone={() => setOpenId(null)} />}
      </DetailSheet>
      {inviting && <InviteModal opened onClose={() => setInviting(false)} />}
      {editingTerms && <ProgramTermsModal onClose={() => setEditingTerms(false)} />}
    </>
  );
}
