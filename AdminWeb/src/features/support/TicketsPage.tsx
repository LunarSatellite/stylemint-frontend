import { useState } from 'react';
import { Alert, Badge, Button, Card, Group, MultiSelect, Paper, Skeleton, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconCircleCheck, IconClockPause, IconReceipt, IconSend } from '@tabler/icons-react';
import { messageOf } from '@/api/errors';
import {
  AUTHOR_KIND,
  COURIER_FAULT,
  COURIER_OUTCOME,
  COURIER_REPORT,
  TICKET_CATEGORY,
  TICKET_FILTER_STATE,
  TICKET_VISIBLE_STATE,
  TICKET_VISIBLE_TONE,
  ticketsApi,
  type Ticket,
  type TicketSummary,
} from '@/api/support';
import { useAuth } from '@/auth/guards';
import { useActionDialog } from '@/components/ActionDialog';
import { IdText, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { PageHeader } from '@/components/PageHeader';
import { ErrorBlock } from '@/components/StateBlocks';
import { useListState } from '@/hooks/useListState';

/** Support tickets, oldest first (a work queue). Reply, mark waiting on the customer, resolve. */
export function TicketsPage() {
  const list = useListState(['states'] as const, { pageSize: 25 });
  const states = (list.filters.states || '').split(',').filter(Boolean).map(Number);
  const query = useQuery({
    queryKey: ['tickets', states.join(','), list.page, list.pageSize],
    queryFn: ({ signal }) => ticketsApi.list(states, list.page, list.pageSize, signal),
    placeholderData: keepPreviousData,
  });
  const columns: Column<TicketSummary>[] = [
    { key: 'subject', header: 'Ticket', render: (t) => <TwoLine primary={t.subject} secondary={<span className="sm-mono">{t.ticketNumber}</span>} /> },
    { key: 'category', header: 'Topic', visibleFrom: 'md', render: (t) => TICKET_CATEGORY[t.category] ?? '—' },
    {
      key: 'state',
      header: 'State',
      render: (t) => (
        <Badge variant="light" color={TICKET_VISIBLE_TONE[t.state]}>
          {TICKET_VISIBLE_STATE[t.state]}
        </Badge>
      ),
    },
    { key: 'opened', header: 'Opened', render: (t) => <When value={t.openedUtc} relative /> },
    { key: 'reply', header: 'Last reply', visibleFrom: 'sm', render: (t) => (t.lastAgentReplyUtc ? <When value={t.lastAgentReplyUtc} relative /> : <Text size="sm" c="amber">None yet</Text>) },
  ];
  return (
    <>
      <PageHeader title="Support tickets" description="Oldest first. By default, tickets that are new or in progress." />
      <DataTable
        label="Support tickets"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(t) => t.ticketNumber}
        onRowClick={(t) => list.open(t.ticketNumber)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        onPageSizeChange={(s) => list.setPageSize(Math.min(50, s))}
        filtered={states.length > 0}
        emptyTitle="Inbox zero"
        emptyBody="No open tickets."
        toolbar={
          <MultiSelect
            label="States"
            placeholder="New and in progress"
            w={360}
            clearable
            data={Object.entries(TICKET_FILTER_STATE).map(([value, label]) => ({ value, label }))}
            value={states.map(String)}
            onChange={(v) => list.setFilter('states', v.length ? v.join(',') : null)}
          />
        }
      />
      <TicketDrawer ticketNumber={list.selected} onClose={() => list.open(null)} />
    </>
  );
}

function TicketDrawer({ ticketNumber, onClose }: { ticketNumber: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const [reply, setReply] = useState('');
  const ticket = useQuery({ queryKey: ['tickets', 'detail', ticketNumber], queryFn: ({ signal }) => ticketsApi.get(ticketNumber!, signal), enabled: !!ticketNumber });
  const t = ticket.data;
  const update = (next: Ticket) => {
    queryClient.setQueryData(['tickets', 'detail', ticketNumber], next);
    void queryClient.invalidateQueries({ queryKey: ['tickets'], exact: false });
  };
  const send = useMutation({
    mutationFn: () => ticketsApi.reply(ticketNumber!, reply.trim()),
    onSuccess: (next) => {
      setReply('');
      update(next);
      notifications.show({ color: 'forest', title: 'Reply sent', message: 'The customer is notified.' });
    },
  });
  const resolved = t?.state === 3;

  const resolve = () =>
    open({
      title: `Resolve ${t?.ticketNumber}`,
      consequence: 'The customer sees the ticket as resolved, with your summary.',
      confirmLabel: 'Resolve ticket',
      fields: [
        { name: 'summary', kind: 'textarea', label: 'Resolution summary', required: true, minLength: 5 },
        ...(t?.courierContext
          ? [
              { name: 'outcome', kind: 'select' as const, label: 'Delivery fault finding', required: true, options: Object.entries(COURIER_OUTCOME).map(([value, label]) => ({ value, label })) },
              { name: 'notes', kind: 'textarea' as const, label: 'Notes on the rider finding' },
            ]
          : []),
      ],
      run: (v) =>
        ticketsApi.resolve(ticketNumber!, {
          resolutionSummary: v.summary!.trim(),
          courierResolutionOutcome: t?.courierContext ? Number(v.outcome) : null,
          courierResolutionNotes: t?.courierContext ? v.notes?.trim() || null : null,
        }),
      success: 'Ticket resolved.',
      onDone: (r) => update(r as Ticket),
    });

  return (
    <DetailDrawer
      opened={!!ticketNumber}
      onClose={onClose}
      title={t?.subject ?? ticketNumber ?? 'Ticket'}
      subtitle={t ? `${t.ticketNumber} · ${TICKET_CATEGORY[t.category]}` : undefined}
      badges={
        t && (
          <Badge variant="light" color={TICKET_VISIBLE_TONE[t.state]}>
            {TICKET_VISIBLE_STATE[t.state]}
          </Badge>
        )
      }
      actions={
        t && (
          <>
            {can('workSupport') && !resolved && (
              <>
                <Button size="sm" leftSection={<IconCircleCheck size={16} />} onClick={resolve}>
                  Resolve…
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  leftSection={<IconClockPause size={16} />}
                  onClick={() =>
                    open({
                      title: 'Wait for the customer',
                      consequence: 'Marks the ticket as waiting on the customer’s reply, so it drops down the work queue.',
                      confirmLabel: 'Mark waiting',
                      run: () => ticketsApi.waitingOnUser(ticketNumber!),
                      success: 'Waiting on the customer.',
                      onDone: (r) => update(r as Ticket),
                    })
                  }
                >
                  Waiting on customer
                </Button>
              </>
            )}
          </>
        )
      }
    >
      {dialog}
      {ticket.error ? (
        <ErrorBlock error={ticket.error} onRetry={() => void ticket.refetch()} />
      ) : !t ? (
        <Skeleton height={240} radius="lg" />
      ) : (
        <Stack gap="md">
          {t.courierContext && (
            <Alert color="blue" variant="light" title="Delivery complaint">
              {t.courierContext.customerFaultReason ? COURIER_FAULT[t.courierContext.customerFaultReason] : null}
              {t.courierContext.courierReportReason ? COURIER_REPORT[t.courierContext.courierReportReason] : null}
              {t.courierContext.resolutionOutcome ? ` · Finding: ${COURIER_OUTCOME[t.courierContext.resolutionOutcome]}` : ''}
            </Alert>
          )}
          {(t.orderId || t.returnRequestId) && (
            <Group gap="lg">
              {t.orderId && (
                <Group gap={6}>
                  <IconReceipt size={14} aria-hidden />
                  <Text size="sm" c="dimmed">
                    Order
                  </Text>
                  <IdText value={t.orderId} />
                </Group>
              )}
              {t.returnRequestId && (
                <Group gap={6}>
                  <Text size="sm" c="dimmed">
                    Return
                  </Text>
                  <IdText value={t.returnRequestId} />
                </Group>
              )}
            </Group>
          )}
          <Stack gap="sm" aria-label="Conversation">
            {t.messages.map((m) => (
              <Paper
                key={m.id}
                p="sm"
                radius="md"
                withBorder
                ml={m.authorKind === 2 ? 'xl' : 0}
                mr={m.authorKind === 2 ? 0 : 'xl'}
                bg={m.authorKind === 2 ? 'var(--sm-active-bg)' : m.authorKind === 3 ? 'var(--sm-inset)' : undefined}
              >
                <Group justify="space-between" gap="xs" mb={4}>
                  <Text size="xs" fw={700}>
                    {m.authorDisplay} · {AUTHOR_KIND[m.authorKind]}
                  </Text>
                  <Text size="xs" c="dimmed">
                    <When value={m.postedUtc} />
                  </Text>
                </Group>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {m.body}
                </Text>
                {m.attachmentUrls.length > 0 && (
                  <Group gap={6} mt={6}>
                    {m.attachmentUrls.map((u, i) => (
                      <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                        Attachment {i + 1}
                      </a>
                    ))}
                  </Group>
                )}
              </Paper>
            ))}
          </Stack>
          {can('workSupport') && !resolved && (
            <Card withBorder padding="sm">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (reply.trim()) send.mutate();
                }}
              >
                <Stack gap="xs">
                  <Textarea label="Reply to the customer" autosize minRows={3} maxRows={10} value={reply} onChange={(e) => setReply(e.currentTarget.value)} />
                  {send.error && (
                    <Text size="sm" c="signal" role="alert">
                      {messageOf(send.error)}
                    </Text>
                  )}
                  <Group justify="flex-end">
                    <Button type="submit" leftSection={<IconSend size={16} />} loading={send.isPending} disabled={!reply.trim()}>
                      Send reply
                    </Button>
                  </Group>
                </Stack>
              </form>
            </Card>
          )}
        </Stack>
      )}
    </DetailDrawer>
  );
}
