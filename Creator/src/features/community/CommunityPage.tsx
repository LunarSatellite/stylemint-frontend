import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  FileButton,
  Group,
  Image,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { IconCalendarPlus, IconCopy, IconPlayerPlay, IconPlayerStop, IconPlus, IconTrash, IconUpload } from '@tabler/icons-react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { messageOf } from '../../api/client';
import { useSession } from '../../auth/useSession';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatCompact, formatDateTime, fromNow, labelOf } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import { useTab } from '../../lib/useTab';
import { partnershipsApi } from '../partnerships/api';
import { profileApi } from '../profile/api';
import { reelsApi } from '../reels/api';
import { studioApi } from '../studio/api';
import {
  checkMedia,
  communityApi,
  dropPartyStateColor,
  dropPartyStateLabel,
  liveStatusColor,
  rememberedParties,
  rememberParty,
  StoryMediaType,
  timeSpanMinutes,
} from './api';

// ---------------------------------------------------------------- stories

function Stories() {
  const { accountId } = useSession();
  const qc = useQueryClient();
  const stories = useQuery({ queryKey: ['community', 'stories', accountId], queryFn: () => communityApi.myStories(accountId!), enabled: !!accountId });
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const post = useMutation({
    mutationFn: async () => {
      const up = await communityApi.uploadMedia(file!);
      const video = up.contentType.startsWith('video/');
      return communityApi.createStory({
        mediaType: video ? StoryMediaType.Video : StoryMediaType.Image,
        mediaUrl: up.url,
        thumbnailUrl: up.thumbnailUrl ?? null,
        caption: caption.trim() || null,
        durationSeconds: video && up.durationSeconds ? Math.min(60, Math.round(up.durationSeconds)) : null,
      });
    },
    onSuccess: () => {
      toastSuccess('Story posted for 24 hours');
      setFile(null);
      setCaption('');
      void qc.invalidateQueries({ queryKey: ['community', 'stories'] });
    },
    onError: (e) => setError(messageOf(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => communityApi.deleteStory(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['community', 'stories'] }),
    onError: (e) => toastError(e),
  });
  return (
    <Stack gap="md">
      <SectionCard title="Post a story" description="A photo or a video up to 60 seconds, visible for 24 hours.">
        <Stack gap="sm" maw={520}>
          {error && <Alert color="signal" variant="light" role="alert">{error}</Alert>}
          <Group>
            <FileButton
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
              onChange={(f) => {
                setError(null);
                if (!f) return;
                const problem = checkMedia(f);
                if (problem) return setError(problem);
                setFile(f);
              }}
            >
              {(props) => (
                <Button {...props} variant="default" leftSection={<IconUpload size={16} />}>
                  {file ? 'Change file' : 'Choose photo or video'}
                </Button>
              )}
            </FileButton>
            {file && <Text size="sm">{file.name}</Text>}
          </Group>
          <TextInput label="Caption" maxLength={500} value={caption} onChange={(e) => setCaption(e.currentTarget.value)} />
          <Group>
            <Button disabled={!file} loading={post.isPending} onClick={() => post.mutate()}>Post story</Button>
          </Group>
        </Stack>
      </SectionCard>
      <SectionCard title="Your active stories">
        {stories.isPending ? (
          <ListSkeleton rows={1} height={120} />
        ) : stories.error ? (
          <ErrorBlock error={stories.error} onRetry={() => void stories.refetch()} title="Could not load your stories" />
        ) : stories.data.length === 0 ? (
          <EmptyBlock title="No active stories" />
        ) : (
          <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="sm">
            {stories.data.map((s) => (
              <Card key={s.id} padding={0} style={{ overflow: 'hidden' }}>
                <Image src={s.thumbnailUrl ?? (s.mediaType === 1 ? s.mediaUrl : undefined)} alt="" h={160} fit="cover" fallbackSrc="" />
                <Stack gap={2} p="xs">
                  <Text size="xs" lineClamp={1}>{s.caption || 'No caption'}</Text>
                  <Text size="xs" c="dimmed">{formatCompact(s.viewCount)} views · ends {fromNow(s.expiresUtc)}</Text>
                  <Button size="compact-xs" variant="subtle" color="signal" leftSection={<IconTrash size={12} />} onClick={() => remove.mutate(s.id)}>
                    Delete
                  </Button>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </SectionCard>
    </Stack>
  );
}

// ---------------------------------------------------------------- live

function ScheduleLiveModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => communityApi.scheduleLive(title.trim(), when!.toISOString(), []),
    onSuccess: () => {
      toastSuccess('Live session scheduled');
      void qc.invalidateQueries({ queryKey: ['community', 'live'] });
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const submit = () => {
    setError(null);
    if (!title.trim()) return setError('Give your live session a title.');
    if (!when || when.getTime() < Date.now() + 5 * 60_000) return setError('Pick a start time at least 5 minutes from now.');
    if (when.getTime() > Date.now() + 30 * 86_400_000) return setError('Pick a start time within the next 30 days.');
    save.mutate();
  };
  return (
    <Modal opened onClose={onClose} title="Schedule a live session">
      <Stack gap="sm">
        {error && <Alert color="signal" variant="light" role="alert">{error}</Alert>}
        <TextInput label="Title" maxLength={120} value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
        <DateTimePicker label="Starts at" value={when} onChange={setWhen} minDate={new Date()} valueFormat="D MMM YYYY, HH:mm" />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={save.isPending}>Schedule</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function Live() {
  const qc = useQueryClient();
  const sessions = useQuery({ queryKey: ['community', 'live'], queryFn: communityApi.myLive });
  const [scheduling, setScheduling] = useState(false);
  const act = useMutation({
    mutationFn: ({ id, start }: { id: string; start: boolean }) =>
      start ? communityApi.startLive(id, `sm-${crypto.randomUUID().slice(0, 18)}`) : communityApi.endLive(id),
    onSuccess: (_d, v) => {
      toastSuccess(v.start ? 'You are live' : 'Live session ended');
      void qc.invalidateQueries({ queryKey: ['community', 'live'] });
    },
    onError: (e) => toastError(e),
  });
  return (
    <SectionCard
      title="Live shopping"
      description="Schedule a live session; shoppers watch and buy in the StyleMint app. Streaming itself happens from the app."
      action={<Button size="xs" leftSection={<IconCalendarPlus size={14} />} onClick={() => setScheduling(true)}>Schedule</Button>}
    >
      {sessions.isPending ? (
        <ListSkeleton rows={2} />
      ) : sessions.error ? (
        <ErrorBlock error={sessions.error} onRetry={() => void sessions.refetch()} title="Could not load your live sessions" />
      ) : sessions.data.length === 0 ? (
        <EmptyBlock title="No live sessions yet" />
      ) : (
        <Stack gap="xs">
          {sessions.data.map((s) => (
            <Card key={s.id} padding="sm" withBorder>
              <Group justify="space-between" wrap="wrap">
                <div>
                  <Group gap="xs">
                    <Text fw={600} size="sm">{s.title}</Text>
                    <Badge size="sm" variant="light" color={liveStatusColor[s.status] ?? 'gray'}>{s.status}</Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {formatDateTime(s.actualStartUtc ?? s.scheduledStartUtc)} · {formatCompact(s.totalViewerCount)} viewers (peak {formatCompact(s.peakViewerCount)})
                  </Text>
                </div>
                {s.status === 'Scheduled' && (
                  <Button size="xs" leftSection={<IconPlayerPlay size={14} />} loading={act.isPending} onClick={() => act.mutate({ id: s.id, start: true })}>
                    Go live
                  </Button>
                )}
                {s.status === 'Live' && (
                  <Button size="xs" color="signal" leftSection={<IconPlayerStop size={14} />} loading={act.isPending} onClick={() => act.mutate({ id: s.id, start: false })}>
                    End
                  </Button>
                )}
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      {scheduling && <ScheduleLiveModal onClose={() => setScheduling(false)} />}
    </SectionCard>
  );
}

// ---------------------------------------------------------------- drop parties

function ScheduleDropModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { accountId } = useSession();
  const profile = useQuery({ queryKey: ['profile', 'creator', accountId], queryFn: () => profileApi.creatorProfile(accountId!), enabled: !!accountId });
  const partners = useQuery({ queryKey: ['partnerships', 'list', 'active-for-drop'], queryFn: () => partnershipsApi.list([3], null, 100) });
  const reels = useQuery({ queryKey: ['reels', 'list', 'for-drop'], queryFn: () => reelsApi.list(null, 100) });
  const [vendor, setVendor] = useState<string | null>(null);
  const [reel, setReel] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [when, setWhen] = useState<Date | null>(null);
  const [minutes, setMinutes] = useState<number>(60);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      communityApi.scheduleParty({
        creatorProfileId: profile.data!.id,
        vendorProfileId: vendor!,
        reelId: reel!,
        title: title.trim(),
        description: description.trim(),
        startsUtc: when!.toISOString(),
        durationMinutes: minutes,
      }),
    onSuccess: (p) => {
      rememberParty(p.id);
      toastSuccess(`Drop party scheduled. Join code ${p.joinCode}`);
      void qc.invalidateQueries({ queryKey: ['community', 'parties'] });
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const submit = () => {
    setError(null);
    if (!profile.data) return setError('Your creator profile is still loading.');
    if (!vendor) return setError('Choose the brand.');
    if (!reel) return setError('Choose the reel the party is built around.');
    if (!title.trim() || !description.trim()) return setError('Add a title and a description.');
    if (!when || when.getTime() <= Date.now()) return setError('Pick a start time in the future.');
    if (minutes < 15 || minutes > 240) return setError('A party lasts 15 to 240 minutes.');
    save.mutate();
  };
  return (
    <Modal opened onClose={onClose} title="Schedule a drop party" size="lg">
      <Stack gap="sm">
        {error && <Alert color="signal" variant="light" role="alert">{error}</Alert>}
        <Select
          label="Brand"
          placeholder={partners.isPending ? 'Loading…' : 'Choose an active partner'}
          data={(partners.data?.items ?? []).map((p) => ({ value: p.vendorProfileId, label: p.vendorName ?? 'Brand' }))}
          value={vendor}
          onChange={setVendor}
          nothingFoundMessage="No active partnerships"
        />
        <Select
          label="Reel"
          placeholder={reels.isPending ? 'Loading…' : 'Choose a published reel'}
          searchable
          data={(reels.data?.items ?? []).filter((r) => r.state === 3).map((r) => ({ value: r.id, label: r.caption?.slice(0, 60) || 'Untitled reel' }))}
          value={reel}
          onChange={setReel}
        />
        <TextInput label="Title" maxLength={120} value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
        <Textarea label="Description" maxLength={2000} autosize minRows={2} value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
        <Group grow>
          <DateTimePicker label="Starts at" value={when} onChange={setWhen} minDate={new Date()} valueFormat="D MMM YYYY, HH:mm" />
          <NumberInput label="Length (minutes)" min={15} max={240} value={minutes} onChange={(v) => setMinutes(Number(v) || 0)} />
        </Group>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={save.isPending}>Schedule</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function DropParties() {
  const qc = useQueryClient();
  const [scheduling, setScheduling] = useState(false);
  const ids = rememberedParties();
  const parties = useQueries({ queries: ids.map((id) => ({ queryKey: ['community', 'parties', id], queryFn: () => communityApi.party(id), retry: false })) });
  const prompt = useQuery({ queryKey: ['studio', 'drop-prompt'], queryFn: studioApi.dropPartyPrompt, retry: false });
  const act = useMutation({
    mutationFn: async ({ id, what }: { id: string; what: 'live' | 'end' | 'cancel' }) =>
      what === 'live' ? communityApi.goLive(id) : what === 'end' ? communityApi.endParty(id) : communityApi.cancelParty(id, 'Cancelled by the creator'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['community', 'parties'] }),
    onError: (e) => toastError(e),
  });
  const list = parties.map((q) => q.data).filter((p): p is NonNullable<typeof p> => !!p);
  return (
    <SectionCard
      title="Drop parties"
      description="A timed shopping event around one of your reels, with a join code for your fans."
      action={<Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setScheduling(true)}>Schedule</Button>}
    >
      <Stack gap="sm">
        {prompt.data && (
          <Alert color="forest" variant="light">{prompt.data.suggestionText}</Alert>
        )}
        {list.length === 0 ? (
          <EmptyBlock title="No drop parties scheduled from this browser" body="Parties you schedule here are listed on this device." />
        ) : (
          list.map((p) => (
            <Card key={p.id} padding="sm" withBorder>
              <Group justify="space-between" wrap="wrap">
                <div>
                  <Group gap="xs">
                    <Text fw={600} size="sm">{p.title}</Text>
                    <Badge size="sm" variant="light" color={dropPartyStateColor[p.state] ?? 'gray'}>{labelOf(dropPartyStateLabel, p.state)}</Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {formatDateTime(p.startsUtc)} · {timeSpanMinutes(p.duration)} min · {p.attendeeCount} attending
                  </Text>
                  <CopyButton value={p.joinCode}>
                    {({ copied, copy }) => (
                      <Button size="compact-xs" variant="subtle" leftSection={<IconCopy size={12} />} onClick={copy}>
                        {copied ? 'Copied' : `Join code ${p.joinCode}`}
                      </Button>
                    )}
                  </CopyButton>
                </div>
                <Group gap="xs">
                  {p.state === 1 && <Button size="xs" onClick={() => act.mutate({ id: p.id, what: 'live' })}>Go live</Button>}
                  {p.state === 2 && <Button size="xs" color="signal" onClick={() => act.mutate({ id: p.id, what: 'end' })}>End</Button>}
                  {p.state === 1 && (
                    <Button size="xs" variant="subtle" color="signal" onClick={() => void confirmAction({ title: 'Cancel this drop party?', body: 'Fans who joined are told it is off.', confirmLabel: 'Cancel party', danger: true, cancelLabel: 'Keep it' }).then((ok) => ok && act.mutate({ id: p.id, what: 'cancel' }))}>
                      Cancel
                    </Button>
                  )}
                  {(p.state === 3 || p.state === 4) && (
                    <Button size="xs" variant="subtle" color="gray" onClick={() => { rememberParty(p.id, true); void qc.invalidateQueries({ queryKey: ['community', 'parties'] }); }}>
                      Hide
                    </Button>
                  )}
                </Group>
              </Group>
            </Card>
          ))
        )}
      </Stack>
      {scheduling && <ScheduleDropModal onClose={() => setScheduling(false)} />}
    </SectionCard>
  );
}

export default function CommunityPage() {
  const [tab, setTab] = useTab(['stories', 'live', 'drops'] as const, 'stories');
  return (
    <>
      <PageHeader title="Stories, drops & live" description="Stay close to your fans between reels." />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="stories">Stories</Tabs.Tab>
          <Tabs.Tab value="live">Live</Tabs.Tab>
          <Tabs.Tab value="drops">Drop parties</Tabs.Tab>
        </Tabs.List>
        {tab === 'stories' ? <Stories /> : tab === 'live' ? <Live /> : <DropParties />}
      </Tabs>
    </>
  );
}
