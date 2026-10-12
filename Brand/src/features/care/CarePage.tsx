import { useState } from 'react';
import {
  Alert,
  Anchor,
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  Image,
  Modal,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
} from '@mantine/core';
import { IconAlertTriangle, IconPhoto } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { messageOf } from '../../api/client';
import { useCursorList } from '../../api/useCursorList';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDateTime, fromNow } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import {
  careApi,
  ClaimState,
  claimStateColor,
  claimStateLabel,
  InquiryState,
  issueKindLabel,
  resolutionKinds,
  ReturnState,
  returnStateColor,
  returnStateLabel,
  type Inquiry,
  type ReturnItem,
  type WarrantyClaim,
} from './api';

// ---------------------------------------------------------------- returns

function RejectReturnModal({ item, onClose }: { item: ReturnItem | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reject = useMutation({
    mutationFn: () => careApi.rejectReturn(item!.id, reason.trim()),
    onSuccess: () => {
      toastSuccess('Return rejected');
      void qc.invalidateQueries({ queryKey: ['care', 'returns'] });
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });
  return (
    <Modal opened={!!item} onClose={onClose} title="Reject return request">
      <Stack gap="md">
        {error && (
          <Alert color="signal" variant="light">
            {error}
          </Alert>
        )}
        <Textarea
          label="Reason (shown to the customer)"
          maxLength={500}
          autosize
          minRows={3}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          required
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button color="signal" loading={reject.isPending} disabled={!reason.trim()} onClick={() => reject.mutate()}>
            Reject return
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function ReturnsTab() {
  const qc = useQueryClient();
  const [state, setState] = useState<string>('1');
  const [rejecting, setRejecting] = useState<ReturnItem | null>(null);
  const list = useCursorList({
    key: ['care', 'returns'],
    resetKey: state,
    fetchPage: (cursor) => careApi.returns(state === 'all' ? null : Number(state), cursor),
  });
  const step = useMutation({
    mutationFn: (s: { run: () => Promise<unknown>; done: string }) => s.run().then(() => s.done),
    onSuccess: (done) => {
      toastSuccess(done);
      void qc.invalidateQueries({ queryKey: ['care', 'returns'] });
    },
    onError: (e) => toastError(e),
  });
  const items = list.query.data?.items ?? [];
  return (
    <>
      <SegmentedControl
        mb="md"
        value={state}
        onChange={setState}
        data={[
          { value: '1', label: 'New' },
          { value: '2', label: 'Awaiting item' },
          { value: '4', label: 'Completed' },
          { value: 'all', label: 'All' },
        ]}
        aria-label="Filter returns"
      />
      {list.query.isPending ? (
        <ListSkeleton rows={3} height={90} />
      ) : list.query.error ? (
        <ErrorBlock error={list.query.error} onRetry={() => void list.query.refetch()} title="Could not load returns" />
      ) : items.length === 0 ? (
        <EmptyBlock title="No return requests here" />
      ) : (
        <Stack gap="sm">
          {items.map((r) => (
            <Card key={r.id} padding="md" withBorder>
              <Group wrap="nowrap" align="flex-start" gap="sm">
                <Avatar src={r.thumbnailUrlSnapshot ?? undefined} radius="md" size={52} color="forest">
                  <IconPhoto size={18} />
                </Avatar>
                <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                  <Group justify="space-between" wrap="wrap" gap="xs">
                    <Text fw={650} size="sm">
                      {r.productTitleSnapshot}
                      {r.variantLabelSnapshot ? ` · ${r.variantLabelSnapshot}` : ''} × {r.quantity}
                    </Text>
                    <Badge color={returnStateColor[r.state]} variant="light">
                      {returnStateLabel[r.state]}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    <Anchor component={Link} to={`/orders/${r.subOrderId}`} size="xs">
                      Order #{r.orderNumber}
                    </Anchor>{' '}
                    · {fromNow(r.submittedUtc)} · customer wants a {r.resolution === 2 ? 'replacement' : 'refund'}
                  </Text>
                  <Text size="sm">“{r.reason}”</Text>
                  {r.evidence?.hasDiscrepancy && (
                    <Alert color="amber" variant="light" p="xs" icon={<IconAlertTriangle size={14} />}>
                      {r.evidence.findings.find((f) => f.kind === 'discrepancy')?.statement ?? 'The evidence does not match the request.'}
                    </Alert>
                  )}
                  {r.rejectionNote && (
                    <Text size="xs" c="dimmed">
                      Your reason: {r.rejectionNote}
                    </Text>
                  )}
                  {r.state === ReturnState.Submitted && (
                    <Group gap="xs" mt={4}>
                      <Button
                        size="xs"
                        loading={step.isPending}
                        onClick={() =>
                          void confirmAction({
                            title: 'Approve this return?',
                            body: 'The customer sends the item back. You refund or replace it when it arrives.',
                            confirmLabel: 'Approve',
                          }).then((ok) => ok && step.mutate({ run: () => careApi.acceptReturn(r.id), done: 'Return approved' }))
                        }
                      >
                        Approve
                      </Button>
                      <Button size="xs" variant="light" color="signal" onClick={() => setRejecting(r)}>
                        Reject
                      </Button>
                    </Group>
                  )}
                  {r.state === ReturnState.Approved && (
                    <Group mt={4}>
                      <Button
                        size="xs"
                        loading={step.isPending}
                        onClick={() =>
                          void confirmAction({
                            title: 'Item received?',
                            body: `Confirm you received the returned item. The customer’s ${r.resolution === 2 ? 'replacement' : 'refund'} is then processed.`,
                            confirmLabel: 'Yes, received',
                          }).then((ok) => ok && step.mutate({ run: () => careApi.completeReturn(r.id), done: 'Return completed' }))
                        }
                      >
                        Item received
                      </Button>
                    </Group>
                  )}
                </Stack>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} shown={items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} />
      <RejectReturnModal item={rejecting} onClose={() => setRejecting(null)} />
    </>
  );
}

// ---------------------------------------------------------------- warranties

function DecideClaimModal({ claim, onClose }: { claim: WarrantyClaim | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [approve, setApprove] = useState<string>('approve');
  const [kind, setKind] = useState<string | null>('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const decide = useMutation({
    mutationFn: () => careApi.decideClaim(claim!.id, approve === 'approve', approve === 'approve' ? Number(kind) : null, note.trim() || null),
    onSuccess: () => {
      toastSuccess('Decision saved');
      void qc.invalidateQueries({ queryKey: ['care', 'claims'] });
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });
  return (
    <Modal opened={!!claim} onClose={onClose} title={claim ? `Warranty claim ${claim.claimNumber}` : ''}>
      {claim && (
        <Stack gap="md">
          <Text size="sm">{claim.description}</Text>
          {claim.evidenceUrls.length > 0 && (
            <SimpleGrid cols={3} spacing="xs">
              {claim.evidenceUrls.map((u) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                  <Image src={u} alt="Evidence photo" h={90} radius="md" fit="cover" />
                </a>
              ))}
            </SimpleGrid>
          )}
          {error && (
            <Alert color="signal" variant="light">
              {error}
            </Alert>
          )}
          <SegmentedControl
            value={approve}
            onChange={setApprove}
            data={[
              { value: 'approve', label: 'Approve' },
              { value: 'reject', label: 'Reject' },
            ]}
          />
          {approve === 'approve' && <Select label="How will you fix it?" data={resolutionKinds} value={kind} onChange={setKind} allowDeselect={false} />}
          <Textarea label="Note to the customer" maxLength={1000} autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button color={approve === 'approve' ? 'forest' : 'signal'} loading={decide.isPending} onClick={() => decide.mutate()}>
              Save decision
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

function WarrantiesTab() {
  const qc = useQueryClient();
  const [state, setState] = useState<string>('1');
  const [deciding, setDeciding] = useState<WarrantyClaim | null>(null);
  const claims = useQuery({ queryKey: ['care', 'claims', state], queryFn: () => careApi.claims(state === 'all' ? null : Number(state)) });
  const step = useMutation({
    mutationFn: (s: { run: () => Promise<unknown>; done: string }) => s.run().then(() => s.done),
    onSuccess: (done) => {
      toastSuccess(done);
      void qc.invalidateQueries({ queryKey: ['care', 'claims'] });
    },
    onError: (e) => toastError(e),
  });
  return (
    <>
      <SegmentedControl
        mb="md"
        value={state}
        onChange={setState}
        data={[
          { value: '1', label: 'New' },
          { value: '2', label: 'Approved' },
          { value: '4', label: 'Repairing' },
          { value: '6', label: 'Resolved' },
          { value: 'all', label: 'All' },
        ]}
        aria-label="Filter warranty claims"
      />
      {claims.isPending ? (
        <ListSkeleton rows={3} height={80} />
      ) : claims.error ? (
        <ErrorBlock error={claims.error} onRetry={() => void claims.refetch()} title="Could not load warranty claims" />
      ) : claims.data.length === 0 ? (
        <EmptyBlock title="No warranty claims here" />
      ) : (
        <Stack gap="sm">
          {claims.data.map((c) => (
            <Card key={c.id} padding="md" withBorder>
              <Group justify="space-between" wrap="wrap" gap="xs">
                <Text fw={650} size="sm">
                  {c.claimNumber} · {issueKindLabel[c.issueKind] ?? 'Issue'}
                </Text>
                <Badge color={claimStateColor[c.state]} variant="light">
                  {claimStateLabel[c.state]}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                Submitted {formatDateTime(c.submittedUtc)}
              </Text>
              <Text size="sm" mt={4} lineClamp={3}>
                {c.description}
              </Text>
              {c.decisionNote && (
                <Text size="xs" c="dimmed" mt={4}>
                  Your note: {c.decisionNote}
                </Text>
              )}
              <Group gap="xs" mt="sm">
                {c.state === ClaimState.Submitted && (
                  <Button size="xs" onClick={() => setDeciding(c)}>
                    Review claim
                  </Button>
                )}
                {c.state === ClaimState.Approved && (
                  <Button size="xs" loading={step.isPending} onClick={() => step.mutate({ run: () => careApi.startClaim(c.id), done: 'Marked in progress' })}>
                    Start repair / replacement
                  </Button>
                )}
                {(c.state === ClaimState.RepairInProgress || c.state === ClaimState.ReplacementInProgress || c.state === ClaimState.Approved) && (
                  <Button
                    size="xs"
                    variant="light"
                    loading={step.isPending}
                    onClick={() =>
                      void confirmAction({ title: 'Mark resolved?', body: 'Confirm the customer’s problem is fixed.', confirmLabel: 'Resolved' }).then(
                        (ok) => ok && step.mutate({ run: () => careApi.resolveClaim(c.id, null), done: 'Claim resolved' }),
                      )
                    }
                  >
                    Mark resolved
                  </Button>
                )}
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      <DecideClaimModal claim={deciding} onClose={() => setDeciding(null)} />
    </>
  );
}

// ---------------------------------------------------------------- questions

function InquiryCard({ q }: { q: Inquiry }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const reply = useMutation({
    mutationFn: () => careApi.reply(q.id, text.trim()),
    onSuccess: () => {
      toastSuccess('Reply sent to the customer');
      void qc.invalidateQueries({ queryKey: ['care', 'questions'] });
    },
    onError: (e) => toastError(e, 'Could not send the reply'),
  });
  const overdue = q.state === InquiryState.Open && Date.parse(q.responseDeadlineUtc) < Date.now();
  return (
    <Card padding="md" withBorder>
      <Group justify="space-between" wrap="wrap" gap="xs">
        <Text size="xs" c="dimmed">
          Asked {fromNow(q.openedUtc)}
          {q.productId && (
            <>
              {' '}
              ·{' '}
              <Anchor component={Link} to={`/products/${q.productId}`} size="xs">
                product
              </Anchor>
            </>
          )}
        </Text>
        {q.state === InquiryState.Open ? (
          <Badge color={overdue ? 'signal' : 'amber'} variant="light">
            {overdue ? 'Reply overdue' : `Reply by ${formatDateTime(q.responseDeadlineUtc)}`}
          </Badge>
        ) : (
          <Badge color={q.state === InquiryState.Replied ? 'forest' : 'gray'} variant="light">
            {q.state === InquiryState.Replied ? 'Answered' : 'Expired'}
          </Badge>
        )}
      </Group>
      <Text fw={600} mt={6}>
        {q.question}
      </Text>
      {q.reply && (
        <Text size="sm" mt={6} c="dimmed">
          Your answer: {q.reply}
        </Text>
      )}
      {q.state === InquiryState.Open &&
        (open ? (
          <Stack gap="xs" mt="sm">
            <Textarea placeholder="Write a helpful answer" autosize minRows={2} maxLength={2000} value={text} onChange={(e) => setText(e.currentTarget.value)} autoFocus />
            <Group justify="flex-end" gap="xs">
              <Button size="xs" variant="default" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="xs" disabled={!text.trim()} loading={reply.isPending} onClick={() => reply.mutate()}>
                Send answer
              </Button>
            </Group>
            <Text size="xs" c="dimmed">
              You can answer once; the customer is notified.
            </Text>
          </Stack>
        ) : (
          <Button size="xs" mt="sm" onClick={() => setOpen(true)}>
            Answer
          </Button>
        ))}
    </Card>
  );
}

function QuestionsTab() {
  const [state, setState] = useState<string>('1');
  const list = useCursorList({
    key: ['care', 'questions'],
    resetKey: state,
    fetchPage: (cursor) => careApi.inquiries(state === 'all' ? null : Number(state), cursor),
  });
  const items = list.query.data?.items ?? [];
  return (
    <>
      <SegmentedControl
        mb="md"
        value={state}
        onChange={setState}
        data={[
          { value: '1', label: 'Unanswered' },
          { value: '2', label: 'Answered' },
          { value: 'all', label: 'All' },
        ]}
        aria-label="Filter questions"
      />
      {list.query.isPending ? (
        <ListSkeleton rows={3} height={80} />
      ) : list.query.error ? (
        <ErrorBlock error={list.query.error} onRetry={() => void list.query.refetch()} title="Could not load questions" />
      ) : items.length === 0 ? (
        <EmptyBlock title={state === '1' ? 'No questions waiting' : 'No questions here'} body="Customers can ask about a product before they buy." />
      ) : (
        <Stack gap="sm">
          {items.map((q) => (
            <InquiryCard key={q.id} q={q} />
          ))}
        </Stack>
      )}
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} shown={items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} />
    </>
  );
}

export default function CarePage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'returns';
  return (
    <>
      <PageHeader title="Returns & questions" description="Handle return requests, warranty claims and customer questions." />
      <Card>
        <Tabs value={tab} onChange={(v) => setParams(v && v !== 'returns' ? { tab: v } : {}, { replace: true })} keepMounted={false}>
          <Tabs.List mb="md">
            <Tabs.Tab value="returns">Returns</Tabs.Tab>
            <Tabs.Tab value="warranty">Warranty</Tabs.Tab>
            <Tabs.Tab value="questions">Questions</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="returns">
            <ReturnsTab />
          </Tabs.Panel>
          <Tabs.Panel value="warranty">
            <WarrantiesTab />
          </Tabs.Panel>
          <Tabs.Panel value="questions">
            <QuestionsTab />
          </Tabs.Panel>
        </Tabs>
      </Card>
    </>
  );
}
