import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { isMissingEndpoint, messageOf } from '../../../api/client';
import { PageHeader } from '../../../components/PageHeader';
import { SectionCard } from '../../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../../components/StateBlocks';
import { confirmAction, toastError, toastSuccess } from '../../../lib/notify';
import { ServiceCategory } from '../category';
import { formatDay, kathmanduDate, RequireServiceCategory, ServiceQuery, ServiceSettingUp, WEEKDAYS } from '../components';
import { BANK_KEY, bankApi, type Branch, type Slot, type SlotWrite } from './api';
import { BRANCHES_KEY, BranchEditor, hoursSummary } from './BranchesPage';

/** "10:00" + 30 → "10:30". */
export function endTime(start: string, minutes: number): string {
  const [h, m] = start.split(':').map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Two active slots of one branch may not overlap on the same weekday (server: 409 bank_slot.overlap). */
export function overlaps(slots: Slot[], candidate: SlotWrite, ignoreId?: string): Slot | null {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const s = toMin(candidate.startTime);
  const e = s + candidate.durationMinutes;
  return (
    slots.find((o) => o.isActive && o.id !== ignoreId && o.dayOfWeek === candidate.dayOfWeek && toMin(o.startTime) < e && s < toMin(o.startTime) + o.durationMinutes) ?? null
  );
}

export default function BranchDetailPage() {
  return (
    <RequireServiceCategory allow={[ServiceCategory.Bank]}>
      <BranchDetailBody />
    </RequireServiceCategory>
  );
}

function BranchDetailBody() {
  const { id = '' } = useParams();
  const branches = useQuery({ queryKey: BRANCHES_KEY, queryFn: () => bankApi.branches() });
  const [editing, setEditing] = useState(false);
  const branch = branches.data?.find((b) => b.id === id);

  return (
    <>
      <PageHeader
        title={branch?.name ?? 'Branch'}
        description={branch ? `${[branch.addressLine, branch.city].filter(Boolean).join(', ')} · ${hoursSummary(branch.openingHours)}` : undefined}
        back={{ to: '/bank/branches', label: 'Branches' }}
        actions={
          branch && (
            <Button variant="default" onClick={() => setEditing(true)}>
              Edit branch
            </Button>
          )
        }
      />
      <ServiceQuery query={branches} what="Branches" errorTitle="Could not load this branch">
        {() =>
          !branch ? (
            <Card>
              <EmptyBlock title="Branch not found" body="It may have been removed, or the link is wrong." />
            </Card>
          ) : (
            <Stack gap="lg">
              {!branch.appointmentsEnabled && (
                <Alert color="amber" variant="light">
                  Appointments are switched off for this branch. Buyers cannot book any slot until you switch them on.
                </Alert>
              )}
              <SlotsSection branch={branch} />
              <HolidaysSection branch={branch} />
              <AvailabilitySection branch={branch} />
            </Stack>
          )
        }
      </ServiceQuery>
      {editing && branch && <BranchEditor branch={branch} onClose={() => setEditing(false)} />}
    </>
  );
}

function SlotsSection({ branch }: { branch: Branch }) {
  const qc = useQueryClient();
  const key = [...BANK_KEY, 'slots', branch.id];
  const slots = useQuery({ queryKey: key, queryFn: () => bankApi.slots(branch.id) });
  const [editing, setEditing] = useState<Slot | 'new' | null>(null);
  const remove = useMutation({
    mutationFn: (slotId: string) => bankApi.deleteSlot(slotId),
    onSuccess: () => {
      toastSuccess('Slot switched off. Existing bookings stay.');
      void qc.invalidateQueries({ queryKey: BANK_KEY });
    },
    onError: (e) => toastError(e),
  });
  const sorted = [...(slots.data ?? [])].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

  return (
    <SectionCard
      title="Weekly appointment slots"
      description="Each slot repeats every week. Capacity is how many buyers can book the same slot."
      action={
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setEditing('new')}>
          Add slot
        </Button>
      }
    >
      <ServiceQuery
        query={slots}
        what="Appointment slots"
        isEmpty={(d) => d.length === 0}
        empty={<EmptyBlock title="No slots yet" body="Add a slot, for example Sunday 10:00 for 30 minutes, 4 people." />}
      >
        {() => (
          <Table.ScrollContainer minWidth={520}>
            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Day</Table.Th>
                  <Table.Th>Time</Table.Th>
                  <Table.Th>Capacity</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th aria-label="Actions" />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sorted.map((s) => (
                  <Table.Tr key={s.id} data-testid={`slot-${s.id}`}>
                    <Table.Td>{WEEKDAYS[s.dayOfWeek]}</Table.Td>
                    <Table.Td>
                      {s.startTime}–{endTime(s.startTime, s.durationMinutes)}
                    </Table.Td>
                    <Table.Td>{s.capacity}</Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="light" color={s.isActive ? 'forest' : 'gray'}>
                        {s.isActive ? 'Active' : 'Off'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Button size="compact-xs" variant="subtle" onClick={() => setEditing(s)}>
                          Edit
                        </Button>
                        {s.isActive && (
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="signal"
                            aria-label={`Switch off ${WEEKDAYS[s.dayOfWeek]} ${s.startTime}`}
                            onClick={async () => {
                              if (await confirmAction({ title: 'Switch off this slot?', body: 'No new bookings. Buyers who already booked keep their appointment.', confirmLabel: 'Switch off', danger: true }))
                                remove.mutate(s.id);
                            }}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </ServiceQuery>
      {editing && <SlotEditor branch={branch} slot={editing === 'new' ? null : editing} existing={slots.data ?? []} onClose={() => setEditing(null)} />}
    </SectionCard>
  );
}

function SlotEditor({ branch, slot, existing, onClose }: { branch: Branch; slot: Slot | null; existing: Slot[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [w, setW] = useState<SlotWrite & { isActive: boolean }>(() =>
    slot ? { dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, durationMinutes: slot.durationMinutes, capacity: slot.capacity, isActive: slot.isActive } : { dayOfWeek: 0, startTime: '10:00', durationMinutes: 30, capacity: 4, isActive: true },
  );
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => (slot ? bankApi.updateSlot(slot.id, w) : bankApi.createSlot(branch.id, { dayOfWeek: w.dayOfWeek, startTime: w.startTime, durationMinutes: w.durationMinutes, capacity: w.capacity })),
    onSuccess: () => {
      toastSuccess(slot ? 'Slot saved.' : 'Slot added.');
      void qc.invalidateQueries({ queryKey: BANK_KEY });
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const submit = () => {
    if (!/^\d{2}:\d{2}$/.test(w.startTime)) return setError('Enter a start time.');
    if (w.durationMinutes < 10 || w.durationMinutes > 240) return setError('A slot lasts 10–240 minutes.');
    if (w.capacity < 1 || w.capacity > 100) return setError('Capacity is 1–100 people.');
    const clash = w.isActive ? overlaps(existing, w, slot?.id) : null;
    if (clash) return setError(`Overlaps the ${WEEKDAYS[clash.dayOfWeek]} ${clash.startTime} slot.`);
    setError(null);
    save.mutate();
  };
  return (
    <Modal opened onClose={onClose} title={slot ? 'Edit slot' : 'Add a slot'}>
      <Stack gap="sm">
        {error && (
          <Alert color="signal" variant="light" role="alert">
            {error}
          </Alert>
        )}
        <Select
          label="Day"
          data={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))}
          value={String(w.dayOfWeek)}
          onChange={(v) => v && setW({ ...w, dayOfWeek: Number(v) })}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
        />
        <SimpleGrid cols={3} spacing="sm">
          <TextInput type="time" label="Starts" value={w.startTime} onChange={(e) => setW({ ...w, startTime: e.currentTarget.value })} />
          <NumberInput label="Minutes" min={10} max={240} step={5} value={w.durationMinutes} onChange={(v) => setW({ ...w, durationMinutes: Number(v) || 0 })} />
          <NumberInput label="Capacity" min={1} max={100} value={w.capacity} onChange={(v) => setW({ ...w, capacity: Number(v) || 0 })} />
        </SimpleGrid>
        {slot && <Switch label="Active" checked={w.isActive} onChange={(e) => setW({ ...w, isActive: e.currentTarget.checked })} />}
        {slot && w.capacity < slot.capacity && (
          <Text size="xs" c="dimmed">
            A lower capacity never cancels bookings already made; it only stops new ones.
          </Text>
        )}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            {slot ? 'Save slot' : 'Add slot'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function HolidaysSection({ branch }: { branch: Branch }) {
  const qc = useQueryClient();
  const today = kathmanduDate();
  const holidays = useQuery({ queryKey: [...BANK_KEY, 'holidays', branch.id, today], queryFn: () => bankApi.holidays(branch.id, today) });
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () => bankApi.addHoliday(branch.id, { date, name: name.trim() }),
    onSuccess: () => {
      toastSuccess('Holiday added. Existing bookings that day stay — cancel them if needed.');
      setDate('');
      setName('');
      void qc.invalidateQueries({ queryKey: BANK_KEY });
    },
    onError: (e) => setError(messageOf(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => bankApi.deleteHoliday(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: BANK_KEY }),
    onError: (e) => toastError(e),
  });
  const submit = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Pick a date.');
    if (date < today) return setError('Pick today or a later date.');
    if (!name.trim()) return setError('Name the holiday, for example Dashain.');
    setError(null);
    add.mutate();
  };
  return (
    <SectionCard title="Holidays" description="The branch takes no appointments on these days.">
      <Stack gap="sm">
        <Group gap="xs" align="flex-end" wrap="wrap">
          <TextInput type="date" label="Date" value={date} min={today} onChange={(e) => setDate(e.currentTarget.value)} />
          <TextInput label="Name" placeholder="Dashain" value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <Button onClick={submit} loading={add.isPending}>
            Add holiday
          </Button>
        </Group>
        {error && (
          <Text size="sm" c="signal">
            {error}
          </Text>
        )}
        <ServiceQuery query={holidays} what="Holidays" isEmpty={(d) => d.length === 0} empty={<Text size="sm" c="dimmed">No upcoming holidays.</Text>}>
          {(list) => (
            <Stack gap={4}>
              {[...list]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((h) => (
                  <Group key={h.id} justify="space-between" data-testid={`holiday-${h.id}`}>
                    <Text size="sm">
                      {formatDay(h.date)} · {h.name}
                    </Text>
                    <ActionIcon size="sm" variant="subtle" color="signal" aria-label={`Remove ${h.name}`} onClick={() => remove.mutate(h.id)}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                ))}
            </Stack>
          )}
        </ServiceQuery>
      </Stack>
    </SectionCard>
  );
}

function AvailabilitySection({ branch }: { branch: Branch }) {
  const from = kathmanduDate();
  const q = useQuery({ queryKey: [...BANK_KEY, 'availability', branch.id, from], queryFn: () => bankApi.availability(branch.id, from, 14) });
  return (
    <SectionCard title="Next 14 days" description="What buyers can book, with seats left per slot.">
      {q.isPending ? (
        <ListSkeleton rows={2} />
      ) : q.error ? (
        isMissingEndpoint(q.error) ? <ServiceSettingUp what="Availability" /> : <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <ScrollArea type="auto">
          <Group gap="sm" wrap="nowrap" align="stretch" pb="xs">
            {(q.data?.days ?? []).map((d) => (
              <Card key={d.date} withBorder padding="xs" miw={130} data-testid={`day-${d.date}`}>
                <Text size="xs" fw={650}>
                  {formatDay(d.date)}
                </Text>
                {d.closed ? (
                  <Text size="xs" c="dimmed">
                    {d.closedReason ?? 'Closed'}
                  </Text>
                ) : d.slots.length === 0 ? (
                  <Text size="xs" c="dimmed">
                    No slots
                  </Text>
                ) : (
                  d.slots.map((s) => (
                    <Text key={s.slotId} size="xs" c={s.status === 1 ? undefined : 'dimmed'}>
                      {s.startTime} · {s.status === 2 ? 'full' : s.status === 3 ? 'past' : s.status === 4 ? 'closed' : `${s.remaining}/${s.capacity} left`}
                    </Text>
                  ))
                )}
              </Card>
            ))}
          </Group>
        </ScrollArea>
      )}
    </SectionCard>
  );
}
