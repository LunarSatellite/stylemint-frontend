import { useState } from 'react';
import { Alert, Button, Card, Group, Menu, Modal, Select, SimpleGrid, Stack, Tabs, Text, TextInput, Textarea, ActionIcon } from '@mantine/core';
import { IconDots, IconFileText, IconPlus, IconUserPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { messageOf } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDate, formatMoney } from '../../lib/format';
import { toastError, toastSuccess } from '../../lib/notify';
import { creatorsApi, RetainerState, type Retainer, type Squad } from './api';
import { AmountInput, confirmAction, CreatorLine, CreatorSearch, CREATORS_KEY } from './components';
import { lookOf, retainerStateLook, squadStateLook } from './labels';

function ProposeRetainerModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [creator, setCreator] = useState<{ id: string; name: string } | null>(null);
  const [amount, setAmount] = useState(15000);
  const [deliverables, setDeliverables] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => creatorsApi.proposeRetainer({ creatorAccountId: creator!.id, monthlyAmount: amount, deliverablesPerMonth: deliverables.trim() }),
    onSuccess: () => {
      toastSuccess('Retainer proposed. The creator is asked to accept.');
      void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'retainers'] });
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const submit = async () => {
    setError(null);
    if (amount <= 0) return setError('Enter the monthly fee.');
    if (!deliverables.trim()) return setError('Say what the creator delivers each month.');
    const ok = await confirmAction({
      title: 'Propose this retainer?',
      body: `${creator?.name} is asked to accept ${formatMoney(amount)} a month for: ${deliverables.trim()}`,
      confirmLabel: 'Send proposal',
    });
    if (ok) save.mutate();
  };
  return (
    <Modal opened onClose={onClose} title="Propose a monthly retainer" size="lg">
      {!creator ? (
        <CreatorSearch excludePartnered={false} onPick={(c) => setCreator({ id: c.creatorAccountId, name: c.displayName })} />
      ) : (
        <Stack>
          {error && (
            <Alert color="signal" variant="light" role="alert">
              {error}
            </Alert>
          )}
          <Group justify="space-between">
            <CreatorLine accountId={creator.id} name={creator.name} />
            <Button size="xs" variant="subtle" onClick={() => setCreator(null)}>
              Change
            </Button>
          </Group>
          <AmountInput label="Monthly fee" value={amount} onChange={setAmount} />
          <Textarea
            label="Deliverables each month"
            placeholder="e.g. 4 reels and 8 stories featuring the new collection"
            maxLength={500}
            autosize
            minRows={2}
            value={deliverables}
            onChange={(e) => setDeliverables(e.currentTarget.value)}
          />
          <Text size="xs" c="dimmed">
            Put renewal, usage rights and payment terms in writing with an agreement after the creator accepts.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={save.isPending} onClick={submit}>
              Propose retainer
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

function RetainerCard({ r }: { r: Retainer }) {
  const qc = useQueryClient();
  const act = useMutation({
    mutationFn: (action: 'pause' | 'resume' | 'cancel') => creatorsApi.retainerAction(r.id, action),
    onSuccess: (_d, action) => {
      toastSuccess(action === 'cancel' ? 'Retainer cancelled' : action === 'pause' ? 'Retainer paused' : 'Retainer resumed');
      void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'retainers'] });
    },
    onError: (e) => toastError(e),
  });
  const ask = async (action: 'pause' | 'resume' | 'cancel') => {
    const copy = {
      pause: { title: 'Pause this retainer?', body: 'No new monthly fee is charged while paused.', label: 'Pause', danger: false },
      resume: { title: 'Resume this retainer?', body: 'Billing restarts from the next period.', label: 'Resume', danger: false },
      cancel: {
        title: 'Cancel this retainer?',
        body: `It ends after the notice period (${r.renewalNoticeDays} days). The current month is still paid.`,
        label: 'Cancel retainer',
        danger: true,
      },
    }[action];
    if (await confirmAction({ title: copy.title, body: copy.body, confirmLabel: copy.label, danger: copy.danger })) act.mutate(action);
  };
  return (
    <Card withBorder padding="md" data-testid="retainer-card">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <CreatorLine accountId={r.creatorAccountId} />
          <Group gap={4} wrap="nowrap">
            <StatusBadge {...lookOf(retainerStateLook, r.state)} />
            <Menu position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="subtle" color="slate" aria-label="Retainer actions">
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item component={Link} to={`/creators/agreements/new?kind=2&retainerId=${r.id}`} leftSection={<IconFileText size={14} />}>
                  Write agreement
                </Menu.Item>
                {r.state === RetainerState.Active && <Menu.Item onClick={() => void ask('pause')}>Pause</Menu.Item>}
                {r.state === RetainerState.Paused && <Menu.Item onClick={() => void ask('resume')}>Resume</Menu.Item>}
                {(r.state === RetainerState.Active || r.state === RetainerState.Paused || r.state === RetainerState.Draft) && (
                  <Menu.Item color="signal" onClick={() => void ask('cancel')}>
                    Cancel retainer
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
        <Text fw={650}>{formatMoney({ amount: r.monthlyAmount, currency: r.currency })} / month</Text>
        <Text size="sm">{r.deliverablesPerMonth}</Text>
        <Text size="xs" c="dimmed">
          {r.nextBillingUtc ? `Next fee ${formatDate(r.nextBillingUtc)}` : 'Not billed yet'} · {r.totalPeriodsCompleted} months done ·{' '}
          {r.autoRenew ? 'renews automatically' : 'does not renew'}
        </Text>
      </Stack>
    </Card>
  );
}

function CreateSquadModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const briefs = useQuery({ queryKey: [CREATORS_KEY, 'briefs', 'locked'], queryFn: () => creatorsApi.briefs([2], null) });
  const [briefId, setBriefId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState(50000);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => creatorsApi.createSquad({ briefId: briefId!, name: name.trim(), budgetTotal: budget }),
    onSuccess: () => {
      toastSuccess('Squad created. Invite creators to it next.');
      void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'squads'] });
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });
  return (
    <Modal opened onClose={onClose} title="New squad">
      <Stack>
        {error && (
          <Alert color="signal" variant="light" role="alert">
            {error}
          </Alert>
        )}
        <Select
          label="Brief"
          description="A squad works on one locked brief."
          placeholder={briefs.isPending ? 'Loading…' : briefs.data?.items.length ? 'Choose a brief' : 'Lock a brief first'}
          data={(briefs.data?.items ?? []).map((b) => ({ value: b.id, label: b.title }))}
          value={briefId}
          onChange={setBriefId}
        />
        <TextInput label="Squad name" maxLength={200} value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <AmountInput label="Total budget" value={budget} onChange={setBudget} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            onClick={() => {
              setError(null);
              if (!briefId) return setError('Choose a brief.');
              if (!name.trim()) return setError('Give the squad a name.');
              if (budget <= 0) return setError('Enter a budget.');
              save.mutate();
            }}
          >
            Create squad
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function InviteToSquadModal({ squad, onClose }: { squad: Squad; onClose: () => void }) {
  const qc = useQueryClient();
  const [creator, setCreator] = useState<{ id: string; name: string } | null>(null);
  const [share, setShare] = useState(10000);
  const invite = useMutation({
    mutationFn: () => creatorsApi.inviteToSquad(squad.id, creator!.id, share),
    onSuccess: () => {
      toastSuccess('Creator invited to the squad');
      void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'squads'] });
      onClose();
    },
    onError: (e) => toastError(e),
  });
  return (
    <Modal opened onClose={onClose} title={`Invite to ${squad.name}`} size="lg">
      {!creator ? (
        <CreatorSearch excludePartnered={false} onPick={(c) => setCreator({ id: c.creatorAccountId, name: c.displayName })} />
      ) : (
        <Stack>
          <CreatorLine accountId={creator.id} name={creator.name} />
          <AmountInput
            label="Their share of the budget"
            description={`Squad budget ${formatMoney({ amount: squad.budgetTotal, currency: squad.budgetCurrency })}`}
            value={share}
            onChange={setShare}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={invite.isPending} disabled={share <= 0} onClick={() => invite.mutate()}>
              Send invitation
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

export default function RetainersPage() {
  const [tab, setTab] = useState<string | null>('retainers');
  const [proposing, setProposing] = useState(false);
  const [creatingSquad, setCreatingSquad] = useState(false);
  const [invitingTo, setInvitingTo] = useState<Squad | null>(null);
  const retainers = useQuery({ queryKey: [CREATORS_KEY, 'retainers'], queryFn: creatorsApi.retainers });
  const squads = useQuery({ queryKey: [CREATORS_KEY, 'squads'], queryFn: creatorsApi.squads, enabled: tab === 'squads' });

  return (
    <>
      <PageHeader
        title="Retainers & squads"
        description="Monthly retainers pay a creator a fixed fee for regular content. Squads group several creators on one campaign brief."
        actions={
          tab === 'squads' ? (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setCreatingSquad(true)}>
              New squad
            </Button>
          ) : (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setProposing(true)}>
              Propose retainer
            </Button>
          )
        }
      />
      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="retainers">Retainers</Tabs.Tab>
          <Tabs.Tab value="squads">Squads</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="retainers">
          {retainers.isPending ? (
            <ListSkeleton rows={3} height={110} />
          ) : retainers.error ? (
            <ErrorBlock error={retainers.error} title="Could not load retainers" onRetry={() => void retainers.refetch()} />
          ) : !retainers.data.length ? (
            <EmptyBlock title="No retainers yet" body="Propose a monthly retainer to a creator you trust." />
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {retainers.data.map((r) => (
                <RetainerCard key={r.id} r={r} />
              ))}
            </SimpleGrid>
          )}
        </Tabs.Panel>
        <Tabs.Panel value="squads">
          {squads.isPending ? (
            <ListSkeleton rows={3} height={90} />
          ) : squads.error ? (
            <ErrorBlock error={squads.error} title="Could not load squads" onRetry={() => void squads.refetch()} />
          ) : !squads.data?.length ? (
            <EmptyBlock title="No squads yet" body="Create a squad on a locked brief, then invite creators with a budget share each." />
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {squads.data.map((s) => (
                <Card key={s.id} withBorder padding="md" data-testid="squad-card">
                  <Stack gap="xs">
                    <Group justify="space-between" wrap="nowrap">
                      <Text fw={650}>{s.name}</Text>
                      <StatusBadge {...lookOf(squadStateLook, s.state)} />
                    </Group>
                    <Text size="sm">
                      {formatMoney({ amount: s.budgetTotal, currency: s.budgetCurrency })} budget · {s.memberCount}{' '}
                      {s.memberCount === 1 ? 'creator' : 'creators'}
                    </Text>
                    {(s.state === 1 || s.state === 2) && (
                      <Button size="xs" variant="light" leftSection={<IconUserPlus size={14} />} onClick={() => setInvitingTo(s)} style={{ alignSelf: 'flex-start' }}>
                        Invite creator
                      </Button>
                    )}
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          )}
        </Tabs.Panel>
      </Tabs>
      {proposing && <ProposeRetainerModal onClose={() => setProposing(false)} />}
      {creatingSquad && <CreateSquadModal onClose={() => setCreatingSquad(false)} />}
      {invitingTo && <InviteToSquadModal squad={invitingTo} onClose={() => setInvitingTo(null)} />}
    </>
  );
}
