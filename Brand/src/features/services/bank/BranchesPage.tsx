import { useState } from 'react';
import { Alert, Anchor, Badge, Button, Card, Checkbox, Group, Modal, SimpleGrid, Stack, Switch, Table, Text, TextInput } from '@mantine/core';
import { IconClock, IconMapPin, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { messageOf } from '../../../api/client';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyBlock } from '../../../components/StateBlocks';
import { toastSuccess } from '../../../lib/notify';
import { ServiceCategory } from '../category';
import { MapPinField, pinError, RequireServiceCategory, ServiceQuery, WEEKDAYS } from '../components';
import { BANK_KEY, bankApi, type Branch, type BranchWrite, type OpeningHours } from './api';

export const BRANCHES_KEY = [...BANK_KEY, 'branches'] as const;

/** "Sun–Fri 10:00–17:00 · Sat closed"-style summary of opening hours. Days missing count as closed. */
export function hoursSummary(hours: OpeningHours[]): string {
  const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));
  const parts: string[] = [];
  let i = 0;
  while (i < 7) {
    const h = byDay.get(i);
    const key = !h || h.closed || !h.opens || !h.closes ? 'closed' : `${h.opens}–${h.closes}`;
    let j = i;
    while (j + 1 < 7) {
      const n = byDay.get(j + 1);
      const nk = !n || n.closed || !n.opens || !n.closes ? 'closed' : `${n.opens}–${n.closes}`;
      if (nk !== key) break;
      j++;
    }
    const days = i === j ? WEEKDAYS[i].slice(0, 3) : `${WEEKDAYS[i].slice(0, 3)}–${WEEKDAYS[j].slice(0, 3)}`;
    parts.push(`${days} ${key}`);
    i = j + 1;
  }
  return parts.join(' · ');
}

/** Default week: Sunday–Friday 10:00–17:00, Saturday closed (the usual Nepali bank week). */
export function defaultHours(): OpeningHours[] {
  return WEEKDAYS.map((_, d) => (d === 6 ? { dayOfWeek: d, opens: null, closes: null, closed: true } : { dayOfWeek: d, opens: '10:00', closes: '17:00', closed: false }));
}

export function validateBranch(b: BranchWrite): string | null {
  if (b.name.trim().length < 2 || b.name.trim().length > 150) return 'Branch name needs 2–150 characters.';
  if (!b.addressLine.trim() || !b.city.trim()) return 'Enter the address and city.';
  if (b.addressLine.length > 300) return 'The address can have at most 300 characters.';
  if ((b.phone ?? '').length > 40) return 'The phone number can have at most 40 characters.';
  const pin = pinError(b);
  if (pin) return pin;
  for (const h of b.openingHours) {
    if (h.closed) continue;
    if (!h.opens || !h.closes) return `Enter opening and closing times for ${WEEKDAYS[h.dayOfWeek]}, or mark it closed.`;
    if (h.opens >= h.closes) return `${WEEKDAYS[h.dayOfWeek]}: the branch must open before it closes.`;
  }
  return null;
}

export default function BranchesPage() {
  return (
    <RequireServiceCategory allow={[ServiceCategory.Bank]}>
      <BranchesBody />
    </RequireServiceCategory>
  );
}

function BranchesBody() {
  const [editing, setEditing] = useState<Branch | 'new' | null>(null);
  const query = useQuery({ queryKey: BRANCHES_KEY, queryFn: () => bankApi.branches() });
  return (
    <>
      <PageHeader
        title="Branches"
        description="Where buyers can visit you. Set opening hours and a map pin; open appointment slots and holidays per branch."
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>
            Add branch
          </Button>
        }
      />
      <ServiceQuery
        query={query}
        what="Branches"
        errorTitle="Could not load your branches"
        isEmpty={(d) => d.length === 0}
        empty={
          <Card>
            <EmptyBlock title="No branches yet" body="Add a branch so buyers can find you and book an appointment." />
          </Card>
        }
      >
        {(branches) => (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            {branches.map((b) => (
              <Card key={b.id} withBorder data-testid={`branch-${b.id}`}>
                <Stack gap={6}>
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <div style={{ minWidth: 0 }}>
                      <Anchor component={Link} to={`/bank/branches/${encodeURIComponent(b.id)}`} fw={650}>
                        {b.name}
                      </Anchor>
                      <Text size="sm" c="dimmed">
                        {[b.addressLine, b.city].filter(Boolean).join(', ')}
                      </Text>
                    </div>
                    <Group gap={4}>
                      {!b.isActive && (
                        <Badge color="gray" variant="light" size="sm">
                          Inactive
                        </Badge>
                      )}
                      <Badge color={b.appointmentsEnabled ? 'forest' : 'gray'} variant="light" size="sm">
                        {b.appointmentsEnabled ? 'Appointments on' : 'No appointments'}
                      </Badge>
                    </Group>
                  </Group>
                  <Text size="sm" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <IconClock size={14} aria-hidden /> {hoursSummary(b.openingHours)}
                  </Text>
                  {b.latitude !== null && b.longitude !== null && (
                    <Text size="xs" c="dimmed" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <IconMapPin size={13} aria-hidden /> {b.latitude}, {b.longitude}
                    </Text>
                  )}
                  <Group gap="xs" mt={4}>
                    <Button size="xs" variant="default" onClick={() => setEditing(b)}>
                      Edit
                    </Button>
                    <Button size="xs" variant="light" component={Link} to={`/bank/branches/${encodeURIComponent(b.id)}`}>
                      Slots & holidays
                    </Button>
                  </Group>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </ServiceQuery>
      {editing && <BranchEditor branch={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function toWrite(b: Branch | null): BranchWrite {
  if (!b)
    return {
      name: '',
      addressLine: '',
      city: '',
      district: '',
      province: '',
      latitude: null,
      longitude: null,
      phone: '',
      openingHours: defaultHours(),
      appointmentsEnabled: true,
      isActive: true,
    };
  const hours = WEEKDAYS.map((_, d) => b.openingHours.find((h) => h.dayOfWeek === d) ?? { dayOfWeek: d, opens: null, closes: null, closed: true });
  return {
    name: b.name,
    addressLine: b.addressLine,
    city: b.city,
    district: b.district ?? '',
    province: b.province ?? '',
    latitude: b.latitude,
    longitude: b.longitude,
    phone: b.phone ?? '',
    openingHours: hours,
    appointmentsEnabled: b.appointmentsEnabled,
    isActive: b.isActive,
  };
}

export function BranchEditor({ branch, onClose }: { branch: Branch | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [w, setW] = useState<BranchWrite>(() => toWrite(branch));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof BranchWrite>(k: K, v: BranchWrite[K]) => setW((prev) => ({ ...prev, [k]: v }));
  const setDay = (d: number, patch: Partial<OpeningHours>) =>
    setW((prev) => ({ ...prev, openingHours: prev.openingHours.map((h) => (h.dayOfWeek === d ? { ...h, ...patch } : h)) }));

  const save = useMutation({
    mutationFn: () => {
      const body: BranchWrite = {
        ...w,
        name: w.name.trim(),
        district: w.district?.trim() || null,
        province: w.province?.trim() || null,
        phone: w.phone?.trim() || null,
        openingHours: w.openingHours.map((h) => (h.closed ? { ...h, opens: null, closes: null } : h)),
      };
      return branch ? bankApi.updateBranch(branch.id, body) : bankApi.createBranch(body);
    },
    onSuccess: () => {
      toastSuccess(branch ? 'Branch saved.' : 'Branch added.');
      void qc.invalidateQueries({ queryKey: BANK_KEY });
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });

  const submit = () => {
    const problem = validateBranch(w);
    setError(problem);
    if (!problem) save.mutate();
  };

  return (
    <Modal opened onClose={onClose} title={branch ? `Edit ${branch.name}` : 'Add a branch'} size="lg">
      <Stack gap="sm">
        {error && (
          <Alert color="signal" variant="light" role="alert">
            {error}
          </Alert>
        )}
        <TextInput label="Branch name" required value={w.name} onChange={(e) => set('name', e.currentTarget.value)} />
        <TextInput label="Address" required value={w.addressLine} onChange={(e) => set('addressLine', e.currentTarget.value)} />
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <TextInput label="City" required value={w.city} onChange={(e) => set('city', e.currentTarget.value)} />
          <TextInput label="District" value={w.district ?? ''} onChange={(e) => set('district', e.currentTarget.value)} />
          <TextInput label="Province" value={w.province ?? ''} onChange={(e) => set('province', e.currentTarget.value)} />
        </SimpleGrid>
        <TextInput label="Branch phone (public)" value={w.phone ?? ''} onChange={(e) => set('phone', e.currentTarget.value)} />
        <MapPinField value={{ latitude: w.latitude, longitude: w.longitude }} onChange={(v) => setW((prev) => ({ ...prev, ...v }))} />
        <Text size="sm" fw={600} mt="xs">
          Opening hours (Kathmandu time)
        </Text>
        <Table withRowBorders={false} verticalSpacing={4}>
          <Table.Tbody>
            {w.openingHours.map((h) => (
              <Table.Tr key={h.dayOfWeek}>
                <Table.Td w={110}>
                  <Text size="sm">{WEEKDAYS[h.dayOfWeek]}</Text>
                </Table.Td>
                <Table.Td w={90}>
                  <Checkbox label="Closed" checked={h.closed} onChange={(e) => setDay(h.dayOfWeek, { closed: e.currentTarget.checked, opens: e.currentTarget.checked ? null : h.opens ?? '10:00', closes: e.currentTarget.checked ? null : h.closes ?? '17:00' })} />
                </Table.Td>
                <Table.Td>
                  {!h.closed && (
                    <Group gap={6} wrap="nowrap">
                      <TextInput type="time" size="xs" aria-label={`${WEEKDAYS[h.dayOfWeek]} opens`} value={h.opens ?? ''} onChange={(e) => setDay(h.dayOfWeek, { opens: e.currentTarget.value || null })} />
                      <Text size="sm">to</Text>
                      <TextInput type="time" size="xs" aria-label={`${WEEKDAYS[h.dayOfWeek]} closes`} value={h.closes ?? ''} onChange={(e) => setDay(h.dayOfWeek, { closes: e.currentTarget.value || null })} />
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Switch label="Buyers can book appointments at this branch" checked={w.appointmentsEnabled} onChange={(e) => set('appointmentsEnabled', e.currentTarget.checked)} />
        <Switch label="Branch is active" checked={w.isActive ?? true} onChange={(e) => set('isActive', e.currentTarget.checked)} />
        <Group justify="flex-end" gap="sm" mt="xs">
          <Button variant="default" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            {branch ? 'Save branch' : 'Add branch'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
