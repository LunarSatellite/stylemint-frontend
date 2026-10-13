import { useMemo } from 'react';
import { Alert, Anchor, Badge, Button, Card, CloseButton, Group, SegmentedControl, Select, Stack, Switch, Table, Text, Tooltip } from '@mantine/core';
import { IconAlertTriangle, IconCircleCheck, IconCircleDashed, IconFileText, IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { isMissingEndpoint } from '../../api/client';
import { useCursorList } from '../../api/useCursorList';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDate } from '../../lib/format';
import { useIsPhone } from '../../lib/useIsPhone';
import { agreementsApi, AgreementStatus, type AgreementFilter, type AgreementSummary } from './agreementsApi';
import { CreatorLine, CREATORS_KEY } from './components';
import { agreementKindLabel, agreementStatusLook, lookOf } from './labels';

const S = AgreementStatus;
const VIEWS: { value: string; label: string; status?: number[] }[] = [
  { value: 'open', label: 'Open', status: [S.Draft, S.SentForSignature, S.PartiallyAccepted, S.Active, S.Amended] },
  { value: 'signature', label: 'Awaiting signature', status: [S.SentForSignature, S.PartiallyAccepted, S.Amended] },
  { value: 'active', label: 'In force', status: [S.Active, S.Amended] },
  { value: 'draft', label: 'Drafts', status: [S.Draft] },
  { value: 'ended', label: 'Ended', status: [S.Terminated, S.Expired, S.Declined, S.Cancelled] },
  { value: 'all', label: 'All' },
];

/** "Agreements are being set up" — the backend has not shipped `v1/vendor/agreements` yet. */
export function AgreementsSettingUp() {
  return (
    <EmptyBlock
      title="Agreements are being set up"
      body="Written agreements with creators will appear here shortly. Your partnerships keep working meanwhile."
    />
  );
}

export function SignatureMarks({ a }: { a: AgreementSummary }) {
  if (a.status === S.Draft || a.vendorAccepted === undefined) return null;
  const mark = (ok: boolean | undefined, who: string) => (
    <Tooltip label={`${who}: ${ok ? 'signed' : 'not signed yet'}`}>
      <span aria-label={`${who} ${ok ? 'signed' : 'not signed yet'}`} style={{ display: 'inline-flex' }}>
        {ok ? <IconCircleCheck size={16} color="var(--mantine-color-forest-6)" /> : <IconCircleDashed size={16} color="var(--sm-text-muted)" />}
      </span>
    </Tooltip>
  );
  return (
    <Group gap={4} wrap="nowrap">
      {mark(a.vendorAccepted, 'You')}
      {mark(a.creatorAccepted, 'Creator')}
    </Group>
  );
}

export function ExpiryText({ iso, status }: { iso: string | null; status: number }) {
  if (!iso) return <Text size="sm" c="dimmed">No end date</Text>;
  const days = dayjs(iso).diff(dayjs(), 'day');
  const live = status === S.Active || status === S.Amended;
  const soon = live && days >= 0 && days <= 30;
  return (
    <Text size="sm" c={soon ? 'signal.7' : undefined} fw={soon ? 600 : undefined}>
      {formatDate(iso)}
      {soon ? ` · ${days === 0 ? 'today' : `in ${days} days`}` : ''}
    </Text>
  );
}

export default function AgreementsPage() {
  const phone = useIsPhone();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') ?? 'open';
  const kind = params.get('kind');
  const expiring = params.get('expiring') === '1';
  const partnershipId = params.get('partnershipId');
  const creatorAccountId = params.get('creatorAccountId');
  const retainerId = params.get('retainerId');

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const filter: AgreementFilter = useMemo(
    () => ({
      status: expiring ? [S.Active, S.Amended] : VIEWS.find((v) => v.value === view)?.status,
      kind: kind ? Number(kind) : undefined,
      partnershipId,
      creatorAccountId,
      retainerId,
      expiringWithinDays: expiring ? 30 : null,
    }),
    [view, kind, expiring, partnershipId, creatorAccountId, retainerId],
  );
  const list = useCursorList({
    key: [CREATORS_KEY, 'agreements', 'list'],
    resetKey: JSON.stringify(filter),
    fetchPage: (cursor) => agreementsApi.list(filter, cursor),
  });
  const expiringSoon = useQuery({
    queryKey: [CREATORS_KEY, 'agreements', 'expiring'],
    queryFn: () => agreementsApi.list({ status: [S.Active, S.Amended], expiringWithinDays: 30 }, null, 50),
    retry: false,
  });
  const expiringCount = expiringSoon.data?.items.length ?? 0;
  const missing = list.query.error && isMissingEndpoint(list.query.error);
  const items = list.query.data?.items ?? [];
  const open = (a: AgreementSummary) => navigate(`/creators/agreements/${a.id}`);

  return (
    <>
      <PageHeader
        title="Agreements & contracts"
        description="Every partnership, retainer and campaign in writing: the agreed terms, who signed and when, amendments and termination. Governed by the laws of Nepal."
        actions={
          <Button component={Link} to="/creators/agreements/new" leftSection={<IconPlus size={16} />}>
            New agreement
          </Button>
        }
      />
      <Stack gap="md">
        {expiringCount > 0 && !expiring && (
          <Alert color="amber" variant="light" icon={<IconAlertTriangle size={18} />} data-testid="expiring-alert">
            <Group justify="space-between" wrap="wrap" gap="xs">
              <Text size="sm">
                {expiringCount} {expiringCount === 1 ? 'agreement ends' : 'agreements end'} in the next 30 days. Renew with an amendment
                or let {expiringCount === 1 ? 'it' : 'them'} lapse.
              </Text>
              <Button size="xs" variant="light" color="amber" onClick={() => set('expiring', '1')}>
                Show them
              </Button>
            </Group>
          </Alert>
        )}
        <Card>
          <Stack gap="md">
            <Group gap="sm" wrap="wrap" align="flex-end">
              <SegmentedControl
                value={view}
                onChange={(v) => set('view', v === 'open' ? null : v)}
                data={VIEWS.map(({ value, label }) => ({ value, label }))}
                orientation={phone ? 'vertical' : 'horizontal'}
                fullWidth={phone}
                disabled={expiring}
                aria-label="Agreement status"
              />
              <Select
                placeholder="Any type"
                aria-label="Agreement type"
                clearable
                w={phone ? '100%' : 170}
                data={Object.entries(agreementKindLabel).map(([value, label]) => ({ value, label }))}
                value={kind}
                onChange={(v) => set('kind', v)}
              />
              <Switch label="Ending within 30 days" checked={expiring} onChange={(e) => set('expiring', e.currentTarget.checked ? '1' : null)} />
            </Group>
            {(partnershipId || creatorAccountId || retainerId) && (
              <Group gap="xs">
                <Badge
                  variant="light"
                  color="slate"
                  rightSection={
                    <CloseButton
                      size="xs"
                      aria-label="Clear filter"
                      onClick={() => {
                        const next = new URLSearchParams(params);
                        next.delete('partnershipId');
                        next.delete('creatorAccountId');
                        next.delete('retainerId');
                        setParams(next, { replace: true });
                      }}
                    />
                  }
                >
                  {partnershipId ? 'One partnership' : retainerId ? 'One retainer' : 'One creator'}
                </Badge>
              </Group>
            )}

            {list.query.isPending ? (
              <ListSkeleton />
            ) : missing ? (
              <AgreementsSettingUp />
            ) : list.query.error ? (
              <ErrorBlock error={list.query.error} title="Could not load agreements" onRetry={() => void list.query.refetch()} />
            ) : items.length === 0 ? (
              <EmptyBlock
                title="No agreements here"
                body="Put a partnership, retainer or campaign in writing. The creator signs it in the StyleMint app."
                action={
                  <Button component={Link} to="/creators/agreements/new" variant="light" leftSection={<IconFileText size={16} />}>
                    Write an agreement
                  </Button>
                }
              />
            ) : phone ? (
              <Stack gap="sm" data-testid="agreement-cards">
                {items.map((a) => (
                  <Card key={a.id} withBorder padding="sm" onClick={() => open(a)} style={{ cursor: 'pointer' }}>
                    <Group justify="space-between" wrap="nowrap" align="flex-start">
                      <div style={{ minWidth: 0 }}>
                        <Text fw={600} truncate>
                          {a.title}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {a.agreementNumber} · {agreementKindLabel[a.kind] ?? 'Agreement'} · v{a.currentVersion}
                        </Text>
                      </div>
                      <StatusBadge {...lookOf(agreementStatusLook, a.status)} />
                    </Group>
                    <Group justify="space-between" mt={8} wrap="nowrap">
                      <CreatorLine accountId={a.creatorAccountId} name={a.creatorName} handle={a.creatorHandle} size={28} />
                      <SignatureMarks a={a} />
                    </Group>
                    <Group gap={4} mt={4}>
                      <Text size="xs" c="dimmed">
                        Ends
                      </Text>
                      <ExpiryText iso={a.expiresAtUtc} status={a.status} />
                    </Group>
                  </Card>
                ))}
              </Stack>
            ) : (
              <Table.ScrollContainer minWidth={760}>
                <Table highlightOnHover verticalSpacing="sm" data-testid="agreement-table">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Agreement</Table.Th>
                      <Table.Th>Creator</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Signed</Table.Th>
                      <Table.Th>Ends</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {items.map((a) => (
                      <Table.Tr key={a.id} onClick={() => open(a)} style={{ cursor: 'pointer' }}>
                        <Table.Td>
                          <Anchor component={Link} to={`/creators/agreements/${a.id}`} fw={600} c="inherit" onClick={(e) => e.stopPropagation()}>
                            {a.title}
                          </Anchor>
                          <Text size="xs" c="dimmed">
                            {a.agreementNumber} · {agreementKindLabel[a.kind] ?? 'Agreement'} · v{a.currentVersion}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <CreatorLine accountId={a.creatorAccountId} name={a.creatorName} handle={a.creatorHandle} size={28} />
                        </Table.Td>
                        <Table.Td>
                          <StatusBadge {...lookOf(agreementStatusLook, a.status)} />
                        </Table.Td>
                        <Table.Td>
                          <SignatureMarks a={a} />
                        </Table.Td>
                        <Table.Td>
                          <ExpiryText iso={a.expiresAtUtc} status={a.status} />
                        </Table.Td>
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
                shown={items.length}
                hasPrev={list.hasPrev}
                hasNext={list.hasNext}
                onPrev={list.prev}
                onNext={list.next}
                busy={list.query.isFetching}
              />
            )}
          </Stack>
        </Card>
      </Stack>
    </>
  );
}
