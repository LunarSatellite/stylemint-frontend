import { useState } from 'react';
import { Alert, Anchor, Badge, Button, Card, Group, Modal, SimpleGrid, Stack, Text, Textarea } from '@mantine/core';
import { IconAddressBook, IconMail, IconPhone, IconShieldCheck } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { isMissingEndpoint, messageOf } from '../../../api/client';
import { PageHeader } from '../../../components/PageHeader';
import { SectionCard } from '../../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../../components/StateBlocks';
import { formatDateTime } from '../../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../../lib/notify';
import { ServiceCategory } from '../category';
import { formatDay, RequireServiceCategory, ServiceSettingUp } from '../components';
import {
  AppointmentStatus,
  appointmentStatusLabel,
  BANK_KEY,
  bankApi,
  bankProductTypeLabel,
  LeadKind,
  LeadStatus,
  leadStatusLabel,
  nextLeadStatuses,
  preferredContactLabel,
  type Appointment,
  type Lead,
} from './api';
import { LeadKindBadge, LeadStatusBadge } from './LeadsPage';

const STATUS_ACTION: Record<number, string> = {
  2: 'Mark contacted',
  3: 'Mark qualified',
  4: 'Mark converted',
  5: 'Close lead',
};

/** The seller CRM holds the same buyer as a contact (service-banks-contract §8); open it by name. */
export const crmLinkFor = (lead: Pick<Lead, 'contact' | 'reference'>) =>
  `/crm/customers?q=${encodeURIComponent(lead.contact?.name ?? lead.reference)}`;

export default function LeadDetailPage() {
  return (
    <RequireServiceCategory allow={[ServiceCategory.Bank]}>
      <LeadDetailBody />
    </RequireServiceCategory>
  );
}

function LeadDetailBody() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: [...BANK_KEY, 'lead', id], queryFn: () => bankApi.lead(id) });
  const lead = q.data;
  return (
    <>
      <PageHeader
        title={lead ? lead.reference : 'Lead'}
        back={{ to: '/bank/leads', label: 'Leads' }}
        meta={
          lead && (
            <Group gap={6}>
              <LeadStatusBadge status={lead.status} />
              <LeadKindBadge kind={lead.kind} />
              <Text size="xs" c="dimmed">
                Received {formatDateTime(lead.createdUtc)}
              </Text>
            </Group>
          )
        }
        actions={
          lead && (
            <Button variant="default" leftSection={<IconAddressBook size={16} />} component={Link} to={crmLinkFor(lead)}>
              Open in CRM
            </Button>
          )
        }
      />
      {q.isPending ? (
        <ListSkeleton rows={3} height={120} />
      ) : q.error ? (
        isMissingEndpoint(q.error) ? (
          <ServiceSettingUp what="Your leads inbox" />
        ) : q.error && (q.error as { status?: number }).status === 404 ? (
          <Card>
            <EmptyBlock title="Lead not found" body="It may belong to another bank, or the link is wrong." />
          </Card>
        ) : (
          <ErrorBlock error={q.error} title="Could not load this lead" onRetry={() => void q.refetch()} />
        )
      ) : lead ? (
        <LeadView lead={lead} />
      ) : null}
    </>
  );
}

function LeadView({ lead }: { lead: Lead }) {
  const product = lead.productName ?? (lead.productType ? bankProductTypeLabel[lead.productType] : null);
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
      <Stack gap="lg">
        <ContactCard lead={lead} />
        <StatusCard lead={lead} />
        {lead.appointment && <AppointmentCard appointment={lead.appointment} />}
      </Stack>
      <Stack gap="lg">
        <SectionCard title={lead.kind === LeadKind.Appointment ? 'Appointment request' : 'Enquiry'}>
          <Stack gap="xs">
            <Text size="sm">
              <Text span c="dimmed">
                Product:{' '}
              </Text>
              {product ?? 'General'}
            </Text>
            {lead.branchName && (
              <Text size="sm">
                <Text span c="dimmed">
                  Branch:{' '}
                </Text>
                {lead.branchName}
              </Text>
            )}
            {lead.answers.map((a) => (
              <Text size="sm" key={a.key} data-testid={`answer-${a.key}`}>
                <Text span c="dimmed">
                  {a.label}:{' '}
                </Text>
                {a.value}
              </Text>
            ))}
            {lead.message && (
              <Card withBorder padding="sm" mt={4}>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {lead.message}
                </Text>
              </Card>
            )}
          </Stack>
        </SectionCard>
        <NotesCard lead={lead} />
      </Stack>
    </SimpleGrid>
  );
}

/** The buyer's consented contact details — only for this lead, because they ticked consent on it. */
function ContactCard({ lead }: { lead: Lead }) {
  if (!lead.contact) {
    return (
      <SectionCard title="Contact">
        <Alert color="gray" variant="light" data-testid="contact-withdrawn">
          The buyer withdrew this {lead.kind === LeadKind.Appointment ? 'appointment' : 'enquiry'}
          {lead.withdrawnUtc ? ` on ${formatDateTime(lead.withdrawnUtc)}` : ''}. Their contact details have been removed — please do not
          contact them about it.
        </Alert>
      </SectionCard>
    );
  }
  const c = lead.contact;
  return (
    <SectionCard title="Contact" description={`Prefers: ${preferredContactLabel[c.preferredMethod] ?? 'Any'}`}>
      <Stack gap="xs" data-testid="lead-contact">
        <Text fw={650}>{c.name}</Text>
        {c.phone && (
          <Anchor href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} size="sm" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <IconPhone size={15} aria-hidden /> {c.phone}
          </Anchor>
        )}
        {c.email && (
          <Anchor href={`mailto:${c.email}`} size="sm" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <IconMail size={15} aria-hidden /> {c.email}
          </Anchor>
        )}
        {lead.consent && (
          <Alert color="forest" variant="light" icon={<IconShieldCheck size={16} />} p="xs" mt={4}>
            <Text size="xs" fw={600}>
              The buyer agreed on {formatDateTime(lead.consent.acceptedUtc)}:
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              “{lead.consent.text}”
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              Use these details only for this {lead.kind === LeadKind.Appointment ? 'appointment' : 'enquiry'}.
            </Text>
          </Alert>
        )}
      </Stack>
    </SectionCard>
  );
}

function StatusCard({ lead }: { lead: Lead }) {
  const qc = useQueryClient();
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const set = useMutation({
    mutationFn: ({ status, why }: { status: number; why?: string }) => bankApi.setLeadStatus(lead.id, status, why),
    onSuccess: (updated) => {
      qc.setQueryData([...BANK_KEY, 'lead', lead.id], updated);
      void qc.invalidateQueries({ queryKey: [...BANK_KEY, 'leads'] });
      toastSuccess(`Lead is now ${leadStatusLabel[updated.status]?.label.toLowerCase() ?? 'updated'}.`);
      setClosing(false);
      setReason('');
    },
    onError: (e) => (closing ? setError(messageOf(e)) : toastError(e)),
  });
  const next = nextLeadStatuses(lead.status);
  return (
    <SectionCard title="Progress" description="New → Contacted → Qualified → Converted, or Closed at any step.">
      <Stack gap="sm">
        {lead.status === LeadStatus.Closed && lead.closedReason && (
          <Text size="sm">
            <Text span c="dimmed">
              Closed because:{' '}
            </Text>
            {lead.closedReason}
          </Text>
        )}
        {next.length === 0 ? (
          <Text size="sm" c="dimmed">
            This lead is finished ({leadStatusLabel[lead.status]?.label.toLowerCase()}).
          </Text>
        ) : (
          <Group gap="xs" wrap="wrap">
            {next.map((s) =>
              s === LeadStatus.Closed ? (
                <Button key={s} size="xs" variant="light" color="gray" onClick={() => setClosing(true)}>
                  {STATUS_ACTION[s]}
                </Button>
              ) : (
                <Button key={s} size="xs" variant={s === next[0] ? 'filled' : 'default'} loading={set.isPending && set.variables?.status === s} onClick={() => set.mutate({ status: s })}>
                  {STATUS_ACTION[s]}
                </Button>
              ),
            )}
          </Group>
        )}
        {lead.statusChangedUtc && (
          <Text size="xs" c="dimmed">
            Last change {formatDateTime(lead.statusChangedUtc)}
          </Text>
        )}
      </Stack>
      <Modal opened={closing} onClose={() => setClosing(false)} title="Close this lead">
        <Stack gap="sm">
          {error && (
            <Alert color="signal" variant="light" role="alert">
              {error}
            </Alert>
          )}
          <Textarea label="Why are you closing it?" required maxLength={300} autosize minRows={2} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setClosing(false)}>
              Cancel
            </Button>
            <Button
              color="signal"
              loading={set.isPending}
              onClick={() => {
                if (!reason.trim()) return setError('Give a short reason.');
                setError(null);
                set.mutate({ status: LeadStatus.Closed, why: reason.trim() });
              }}
            >
              Close lead
            </Button>
          </Group>
        </Stack>
      </Modal>
    </SectionCard>
  );
}

export function AppointmentStatusBadge({ status }: { status: number }) {
  const s = appointmentStatusLabel[status] ?? { label: 'Unknown', color: 'gray' };
  return (
    <Badge variant="light" color={s.color} size="sm">
      {s.label}
    </Badge>
  );
}

/** Complete / no-show once the slot has started; cancel (with a reason the buyer sees) while it is booked. */
export function AppointmentActions({ appointment: a, now = Date.now() }: { appointment: Appointment; now?: number }) {
  const qc = useQueryClient();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const done = (msg: string) => {
    toastSuccess(msg);
    void qc.invalidateQueries({ queryKey: BANK_KEY });
  };
  const complete = useMutation({ mutationFn: () => bankApi.completeAppointment(a.id), onSuccess: () => done('Marked as completed.'), onError: (e) => toastError(e) });
  const noShow = useMutation({ mutationFn: () => bankApi.noShowAppointment(a.id), onSuccess: () => done('Marked as no-show.'), onError: (e) => toastError(e) });
  const cancel = useMutation({
    mutationFn: () => bankApi.cancelAppointment(a.id, reason.trim()),
    onSuccess: () => {
      setCancelling(false);
      done('Appointment cancelled. The buyer has been told.');
    },
    onError: (e) => setError(messageOf(e)),
  });
  if (a.status !== AppointmentStatus.Booked) return null;
  const started = now >= new Date(a.startUtc).getTime();
  return (
    <>
      <Group gap="xs" wrap="wrap">
        {started && (
          <>
            <Button size="xs" loading={complete.isPending} onClick={() => complete.mutate()}>
              Mark completed
            </Button>
            <Button
              size="xs"
              variant="default"
              loading={noShow.isPending}
              onClick={async () => {
                if (await confirmAction({ title: 'Mark as no-show?', body: 'The buyer did not come to the branch.', confirmLabel: 'Mark no-show' })) noShow.mutate();
              }}
            >
              No-show
            </Button>
          </>
        )}
        <Button size="xs" variant="light" color="signal" onClick={() => setCancelling(true)}>
          Cancel appointment
        </Button>
      </Group>
      <Modal opened={cancelling} onClose={() => setCancelling(false)} title={`Cancel ${a.reference}`}>
        <Stack gap="sm">
          <Text size="sm">The buyer gets a notification with your reason, and the seat is freed.</Text>
          {error && (
            <Alert color="signal" variant="light" role="alert">
              {error}
            </Alert>
          )}
          <Textarea label="Reason" required autosize minRows={2} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setCancelling(false)}>
              Keep it
            </Button>
            <Button
              color="signal"
              loading={cancel.isPending}
              onClick={() => {
                if (!reason.trim()) return setError('Give a reason — the buyer sees it.');
                setError(null);
                cancel.mutate();
              }}
            >
              Cancel appointment
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function AppointmentCard({ appointment: a }: { appointment: Appointment }) {
  return (
    <SectionCard title="Appointment" action={<AppointmentStatusBadge status={a.status} />}>
      <Stack gap="xs">
        <Text size="sm" fw={600}>
          {formatDay(a.date)} · {a.startTime}–{a.endTime}
        </Text>
        <Text size="sm">
          {a.branchName}
          {a.branchAddress ? ` — ${a.branchAddress}` : ''}
        </Text>
        {a.purpose && (
          <Text size="sm" c="dimmed">
            {a.purpose}
          </Text>
        )}
        {a.status === AppointmentStatus.Cancelled && a.cancelReason && (
          <Text size="sm" c="dimmed">
            Cancelled by {a.cancelledBy === 1 ? 'the buyer' : 'you'}: {a.cancelReason}
          </Text>
        )}
        <AppointmentActions appointment={a} />
      </Stack>
    </SectionCard>
  );
}

function NotesCard({ lead }: { lead: Lead }) {
  const qc = useQueryClient();
  const key = [...BANK_KEY, 'lead', lead.id, 'notes'];
  const notes = useQuery({ queryKey: key, queryFn: () => bankApi.notes(lead.id) });
  const [text, setText] = useState('');
  const add = useMutation({
    mutationFn: () => bankApi.addNote(lead.id, text.trim()),
    onSuccess: () => {
      setText('');
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toastError(e),
  });
  return (
    <SectionCard title="Notes" description="Only your team sees these — never the buyer.">
      <Stack gap="sm">
        {notes.isPending ? (
          <ListSkeleton rows={2} height={40} />
        ) : notes.error ? (
          isMissingEndpoint(notes.error) ? (
            <Text size="sm" c="dimmed">
              Notes are being set up.
            </Text>
          ) : (
            <ErrorBlock error={notes.error} onRetry={() => void notes.refetch()} />
          )
        ) : (notes.data ?? []).length === 0 ? (
          <Text size="sm" c="dimmed">
            No notes yet.
          </Text>
        ) : (
          (notes.data ?? []).map((n) => (
            <Card key={n.id} withBorder padding="xs" data-testid={`note-${n.id}`}>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {n.text}
              </Text>
              <Text size="xs" c="dimmed">
                {formatDateTime(n.createdUtc)}
              </Text>
            </Card>
          ))
        )}
        <Textarea placeholder="Add a note — e.g. Called, will visit Sunday" aria-label="New note" autosize minRows={2} maxLength={2000} value={text} onChange={(e) => setText(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button size="xs" onClick={() => add.mutate()} disabled={!text.trim()} loading={add.isPending}>
            Add note
          </Button>
        </Group>
      </Stack>
    </SectionCard>
  );
}
