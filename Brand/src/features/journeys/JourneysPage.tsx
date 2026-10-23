import { useState } from 'react';
import { Alert, Badge, Button, Card, Group, Modal, SegmentedControl, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { IconMailForward, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { isMissingEndpoint } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { fromNow } from '../../lib/format';
import { toastSuccess } from '../../lib/notify';
import {
  CITY_MAX,
  JOURNEYS_KEY,
  JourneyRole,
  JourneyState,
  journeyErrorMessage,
  journeysApi,
  journeyTitle,
  roleLabel,
  TITLE_MAX,
  validateJourneyText,
  type VendorJourney,
} from './api';
import { JourneyPreview, JourneysSettingUp, JourneyStateBadge, ReelPicker, ReelThumb } from './components';

export const journeyPath = (id: string) => `/journeys/${encodeURIComponent(id)}`;

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: '1', label: 'Mine' },
  { value: '2', label: 'Joined' },
  { value: '3', label: 'Invites' },
];

/** Journeys this business owns, is a member of, or is invited to (contract §4 `GET /v1/vendor/journeys`). */
export default function JourneysPage() {
  const [params, setParams] = useSearchParams();
  const roleParam = params.get('role');
  const role = roleParam && ['1', '2', '3'].includes(roleParam) ? roleParam : 'all';
  const [creating, setCreating] = useState(false);
  const query = useQuery({
    queryKey: [...JOURNEYS_KEY, 'list', role],
    queryFn: () => journeysApi.list({ role: role === 'all' ? undefined : Number(role) }),
  });
  const missing = isMissingEndpoint(query.error);
  const items = query.data?.items ?? [];
  const invites = items.filter((j) => j.myRole === JourneyRole.Invitee && j.state === JourneyState.Active);

  return (
    <>
      <PageHeader
        title="Journeys"
        description="Link your reel with reels from other businesses — a bus ride, a hotel, an activity — so buyers swipe through the whole trip in order."
        actions={
          !missing && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
              New journey
            </Button>
          )
        }
      />
      {missing ? (
        <JourneysSettingUp />
      ) : (
        <Stack gap="md">
          <SegmentedControl
            aria-label="Show journeys"
            data={FILTERS}
            value={role}
            onChange={(v) => setParams(v === 'all' ? new URLSearchParams() : new URLSearchParams({ role: v }), { replace: true })}
            style={{ alignSelf: 'flex-start' }}
          />
          {role === 'all' && invites.length > 0 && (
            <Alert variant="light" color="amber" icon={<IconMailForward size={18} />} title={`${invites.length} ${invites.length === 1 ? 'business has' : 'businesses have'} invited you`}>
              <Text size="sm">Open an invitation to add one of your reels to their journey, or decline it.</Text>
            </Alert>
          )}
          {query.isPending ? (
            <ListSkeleton rows={3} height={110} />
          ) : query.error ? (
            <ErrorBlock error={query.error} title="Could not load your journeys" onRetry={() => void query.refetch()} />
          ) : items.length === 0 ? (
            <Card>
              <EmptyBlock
                title={role === '3' ? 'No invitations' : 'No journeys yet'}
                body={
                  role === '3'
                    ? 'When another business invites you to a journey, it shows here.'
                    : 'Start a journey with one of your published reels, then invite the businesses that come next.'
                }
                action={
                  role !== '3' && (
                    <Button size="sm" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setCreating(true)}>
                      New journey
                    </Button>
                  )
                }
              />
            </Card>
          ) : (
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              {items.map((j) => (
                <JourneyCard key={j.id} j={j} />
              ))}
            </SimpleGrid>
          )}
        </Stack>
      )}
      <CreateJourneyModal opened={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function JourneyCard({ j }: { j: VendorJourney }) {
  const invited = j.myRole === JourneyRole.Invitee;
  return (
    <Card withBorder component={Link} to={journeyPath(j.id)} padding="sm" data-testid={`journey-${j.id}`}>
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <ReelThumb url={j.steps[0]?.thumbnailUrl ?? null} size={40} />
            <Stack gap={0} style={{ minWidth: 0 }}>
              <Text fw={650} truncate>
                {journeyTitle(j)}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {[j.city, `${j.steps.length} ${j.steps.length === 1 ? 'step' : 'steps'}`, invited ? `from ${j.ownerName}` : null, `updated ${fromNow(j.updatedUtc)}`]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </Stack>
          </Group>
          <Stack gap={4} align="flex-end">
            <Badge variant={invited ? 'filled' : 'outline'} color={invited ? 'amber' : 'gray'} size="sm">
              {roleLabel[j.myRole] ?? 'Member'}
            </Badge>
            <JourneyStateBadge journey={j} />
          </Stack>
        </Group>
        <JourneyPreview steps={j.steps} />
      </Stack>
    </Card>
  );
}

function CreateJourneyModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [reelId, setReelId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const invalid = validateJourneyText(title, city);
  const reset = () => {
    setTitle('');
    setCity('');
    setReelId(null);
  };
  const create = useMutation({
    mutationFn: () => journeysApi.create({ title: title.trim() || null, city: city.trim() || null, reelId: reelId! }),
    onSuccess: (j) => {
      queryClient.setQueryData([...JOURNEYS_KEY, 'detail', j.id], j);
      void queryClient.invalidateQueries({ queryKey: JOURNEYS_KEY });
      toastSuccess('Journey created. Now invite the businesses that come next.');
      reset();
      onClose();
      navigate(journeyPath(j.id));
    },
  });
  const close = () => {
    reset();
    create.reset();
    onClose();
  };
  return (
    <Modal opened={opened} onClose={close} title="New journey" size="lg">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Your reel becomes step 1. After that you invite other businesses; each adds one of their own reels.
        </Text>
        <TextInput label="Title (optional)" placeholder="Kathmandu → Pokhara weekend" value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.currentTarget.value)} />
        <TextInput label="City (optional)" placeholder="Pokhara" value={city} maxLength={CITY_MAX} onChange={(e) => setCity(e.currentTarget.value)} />
        <Stack gap={6}>
          <Text size="sm" fw={500}>
            Your reel for step 1
          </Text>
          {opened && <ReelPicker value={reelId} onChange={setReelId} />}
        </Stack>
        {invalid && (
          <Text size="sm" c="signal">
            {invalid}
          </Text>
        )}
        {create.error && (
          <Alert variant="light" color="signal" role="alert">
            {journeyErrorMessage(create.error)}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            Cancel
          </Button>
          <Button disabled={!reelId || !!invalid} loading={create.isPending} onClick={() => create.mutate()}>
            Create journey
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
