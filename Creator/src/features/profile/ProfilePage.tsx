import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  FileButton,
  Group,
  Image,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconCamera, IconPhoto, IconRosetteDiscountCheck, IconStar, IconStarFilled, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, messageOf } from '../../api/client';
import { useSession } from '../../auth/useSession';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatCompact, initialsOf } from '../../lib/format';
import { toastError, toastSuccess } from '../../lib/notify';
import {
  AVATAR_TYPES,
  checkImage,
  COVER_TYPES,
  MAX_SPECIALIZATIONS,
  PROFILE_LIMITS,
  profileApi,
  type Account,
  type CreatorProfile,
} from './api';

function Header({ accountId, account, profile }: { accountId: string; account: Account; profile: CreatorProfile }) {
  const qc = useQueryClient();
  const stats = useQuery({ queryKey: ['profile', 'reel-stats', accountId], queryFn: () => profileApi.reelStats(accountId) });
  const follows = useQuery({ queryKey: ['profile', 'follows', accountId], queryFn: () => profileApi.followStats(accountId) });
  const [error, setError] = useState<string | null>(null);

  const avatar = useMutation({
    mutationFn: async (file: File) => {
      const { url } = await profileApi.uploadAvatar(file);
      return profileApi.updateAccount(accountId, { displayName: account.displayName, avatarUrl: url, rowVersion: account.rowVersion });
    },
    onSuccess: () => {
      toastSuccess('Profile photo updated');
      void qc.invalidateQueries({ queryKey: ['account'] });
      void qc.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (e) => setError(e instanceof ApiError && e.status === 413 ? 'The image is too large. Use one under 5 MB.' : messageOf(e)),
  });
  const cover = useMutation({
    mutationFn: (file: File) => profileApi.uploadCover(file),
    onSuccess: () => {
      toastSuccess('Cover updated');
      void qc.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (e) => setError(e instanceof ApiError && e.status === 413 ? 'The image is too large. Use one under 5 MB.' : messageOf(e)),
  });
  const pick = (file: File | null, types: string[], go: (f: File) => void) => {
    setError(null);
    if (!file) return;
    const problem = checkImage(file, types);
    if (problem) return setError(problem);
    go(file);
  };

  const stat = (label: string, value: number | undefined) => (
    <div>
      <Text fw={700} fz="lg">
        {value === undefined ? '…' : formatCompact(value)}
      </Text>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
    </div>
  );

  return (
    <Card padding={0} mb="md" style={{ overflow: 'hidden' }}>
      <Box style={{ position: 'relative', height: 160, background: 'linear-gradient(120deg, #a2d7c0, #00784f)' }}>
        {profile.coverImageUrl && <Image src={profile.coverImageUrl} alt="" h={160} w="100%" fit="cover" />}
        <FileButton onChange={(f) => pick(f, COVER_TYPES, (x) => cover.mutate(x))} accept={COVER_TYPES.join(',')}>
          {(props) => (
            <Button {...props} size="xs" variant="white" color="dark" leftSection={<IconPhoto size={14} />} pos="absolute" top={10} right={10} loading={cover.isPending}>
              Change cover
            </Button>
          )}
        </FileButton>
      </Box>
      <Group p="md" gap="md" align="flex-end" wrap="wrap" mt={-48}>
        <Box pos="relative">
          <Avatar src={account.avatarUrl ?? undefined} size={88} radius={44} color="forest" style={{ border: '4px solid var(--sm-raised)' }}>
            {initialsOf(account.displayName)}
          </Avatar>
          <FileButton onChange={(f) => pick(f, AVATAR_TYPES, (x) => avatar.mutate(x))} accept={AVATAR_TYPES.join(',')}>
            {(props) => (
              <Tooltip label="Change photo">
                <ActionIcon {...props} radius="xl" size="md" pos="absolute" bottom={2} right={2} aria-label="Change profile photo" loading={avatar.isPending}>
                  <IconCamera size={14} />
                </ActionIcon>
              </Tooltip>
            )}
          </FileButton>
        </Box>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Group gap={6}>
            <Text fw={700} fz="xl">
              {account.displayName}
            </Text>
            {profile.isVerified && <IconRosetteDiscountCheck size={20} color="var(--sm-accent)" aria-label="Verified creator" />}
          </Group>
          <Text size="sm" c="dimmed">
            {profile.specializationSummary || 'Add a one-line summary of what you create'}
          </Text>
        </div>
        <Group gap="xl">
          {stat('Followers', follows.data?.followers)}
          {stat('Reels', stats.data?.publishedReelCount)}
          {stat('Likes', stats.data?.totalStyleMintLikes)}
        </Group>
      </Group>
      {error && (
        <Alert color="signal" variant="light" m="md" mt={0} role="alert" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Card>
  );
}

function AboutForm({ accountId, account, profile }: { accountId: string; account: Account; profile: CreatorProfile }) {
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState(account.displayName);
  const [summary, setSummary] = useState(profile.specializationSummary ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [location, setLocation] = useState(profile.location ?? '');
  const [tags, setTags] = useState<string[]>(profile.tags ?? []);
  const [handles, setHandles] = useState({
    instagramHandle: profile.instagramHandle ?? '',
    tiktokHandle: profile.tiktokHandle ?? '',
    youtubeHandle: profile.youtubeHandle ?? '',
    facebookHandle: profile.facebookHandle ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (displayName.trim() !== account.displayName) {
        await profileApi.updateAccount(accountId, { displayName: displayName.trim(), rowVersion: account.rowVersion });
      }
      return profileApi.updateCreatorProfile(accountId, {
        bio: bio.trim(),
        specializationSummary: summary.trim(),
        location: location.trim(),
        tags,
        instagramHandle: handles.instagramHandle.trim().replace(/^@/, ''),
        tiktokHandle: handles.tiktokHandle.trim().replace(/^@/, ''),
        youtubeHandle: handles.youtubeHandle.trim().replace(/^@/, ''),
        facebookHandle: handles.facebookHandle.trim().replace(/^@/, ''),
      });
    },
    onSuccess: () => {
      toastSuccess('Profile saved. Your public page updates within a minute.');
      void qc.invalidateQueries({ queryKey: ['profile'] });
      void qc.invalidateQueries({ queryKey: ['account'] });
    },
    onError: (e) =>
      setError(e instanceof ApiError && e.code === 'state.concurrency_conflict' ? 'Your profile changed elsewhere. Reload the page and try again.' : messageOf(e)),
  });

  const submit = () => {
    setError(null);
    if (!displayName.trim()) return setError('Your name cannot be empty.');
    if (!/^[\p{L}\p{N}\s'._-]+$/u.test(displayName.trim())) return setError('Your name can use letters, numbers, spaces and . _ - \' only.');
    save.mutate();
  };

  return (
    <SectionCard title="About you" description="Shown on your public creator page and to brands.">
      <Stack gap="sm" maw={720}>
        {error && (
          <Alert color="signal" variant="light" role="alert">
            {error}
          </Alert>
        )}
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Name" maxLength={PROFILE_LIMITS.displayName} value={displayName} onChange={(e) => setDisplayName(e.currentTarget.value)} required />
          <TextInput label="Location" placeholder="Kathmandu" maxLength={PROFILE_LIMITS.location} value={location} onChange={(e) => setLocation(e.currentTarget.value)} />
        </SimpleGrid>
        <TextInput
          label="What you create, in one line"
          placeholder="Everyday ethnic wear, styled three ways"
          maxLength={PROFILE_LIMITS.specializationSummary}
          value={summary}
          onChange={(e) => setSummary(e.currentTarget.value)}
          description={`${summary.length}/${PROFILE_LIMITS.specializationSummary}`}
        />
        <Textarea label="Bio" autosize minRows={3} maxLength={PROFILE_LIMITS.bio} value={bio} onChange={(e) => setBio(e.currentTarget.value)} description={`${bio.length}/${PROFILE_LIMITS.bio}`} />
        <TagsInput
          label="Style tags"
          description="Up to 20, e.g. streetwear, kurta, thrift"
          maxTags={PROFILE_LIMITS.maxTags}
          value={tags}
          onChange={(v) => setTags(v.map((t) => t.slice(0, PROFILE_LIMITS.tagMaxLength)))}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Instagram" leftSection="@" maxLength={PROFILE_LIMITS.instagramHandle} value={handles.instagramHandle} onChange={(e) => setHandles({ ...handles, instagramHandle: e.currentTarget.value })} />
          <TextInput label="TikTok" leftSection="@" maxLength={PROFILE_LIMITS.tiktokHandle} value={handles.tiktokHandle} onChange={(e) => setHandles({ ...handles, tiktokHandle: e.currentTarget.value })} />
          <TextInput label="YouTube" leftSection="@" maxLength={PROFILE_LIMITS.youtubeHandle} value={handles.youtubeHandle} onChange={(e) => setHandles({ ...handles, youtubeHandle: e.currentTarget.value })} />
          <TextInput label="Facebook" maxLength={PROFILE_LIMITS.facebookHandle} value={handles.facebookHandle} onChange={(e) => setHandles({ ...handles, facebookHandle: e.currentTarget.value })} />
        </SimpleGrid>
        <Group>
          <Button onClick={submit} loading={save.isPending}>
            Save profile
          </Button>
        </Group>
      </Stack>
    </SectionCard>
  );
}

function Specializations({ accountId }: { accountId: string }) {
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ['profile', 'specializations', accountId], queryFn: () => profileApi.specializations(accountId) });
  const categories = useQuery({ queryKey: ['catalog', 'categories'], queryFn: profileApi.categories, staleTime: 60 * 60_000 });
  const [pick, setPick] = useState<string | null>(null);
  const names = useMemo(() => new Map((categories.data ?? []).map((c) => [c.id, c.nameEn])), [categories.data]);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['profile', 'specializations', accountId] });
  const add = useMutation({
    mutationFn: (id: string) => profileApi.addSpecialization(accountId, id, (mine.data ?? []).length === 0),
    onSuccess: () => {
      setPick(null);
      refresh();
    },
    onError: (e) => toastError(e, e instanceof ApiError && e.code === 'state.duplicate' ? 'Already added' : 'Could not add'),
  });
  const primary = useMutation({ mutationFn: (id: string) => profileApi.setPrimarySpecialization(accountId, id), onSuccess: refresh, onError: (e) => toastError(e) });
  const remove = useMutation({ mutationFn: (id: string) => profileApi.removeSpecialization(accountId, id), onSuccess: refresh, onError: (e) => toastError(e) });
  const list = mine.data ?? [];
  const taken = new Set(list.map((s) => s.categoryId));
  return (
    <SectionCard title="What you post about" description={`Brands find you by these. Up to ${MAX_SPECIALIZATIONS}; star your main one.`}>
      {mine.isPending ? (
        <ListSkeleton rows={1} height={36} />
      ) : mine.error ? (
        <ErrorBlock error={mine.error} onRetry={() => void mine.refetch()} title="Could not load your categories" />
      ) : (
        <Stack gap="sm">
          <Group gap="xs">
            {list.length === 0 && (
              <Text size="sm" c="dimmed">
                None yet.
              </Text>
            )}
            {list.map((s) => (
              <Badge
                key={s.id}
                size="lg"
                variant={s.isPrimary ? 'filled' : 'light'}
                leftSection={
                  <ActionIcon size="xs" variant="transparent" color={s.isPrimary ? 'white' : 'forest'} aria-label="Make main category" onClick={() => !s.isPrimary && primary.mutate(s.categoryId)}>
                    {s.isPrimary ? <IconStarFilled size={12} /> : <IconStar size={12} />}
                  </ActionIcon>
                }
                rightSection={
                  <ActionIcon size="xs" variant="transparent" color={s.isPrimary ? 'white' : 'gray'} aria-label={`Remove ${names.get(s.categoryId) ?? 'category'}`} onClick={() => remove.mutate(s.categoryId)}>
                    <IconX size={12} />
                  </ActionIcon>
                }
              >
                {names.get(s.categoryId) ?? 'Category'}
              </Badge>
            ))}
          </Group>
          {list.length < MAX_SPECIALIZATIONS && (
            <Group align="flex-end">
              <Select
                label="Add a category"
                placeholder={categories.isPending ? 'Loading…' : categories.error ? 'Could not load categories' : 'Choose'}
                searchable
                data={(categories.data ?? []).filter((c) => c.isActive && !taken.has(c.id)).map((c) => ({ value: c.id, label: c.nameEn }))}
                value={pick}
                onChange={setPick}
                w={260}
                disabled={!!categories.error}
              />
              <Button disabled={!pick} loading={add.isPending} onClick={() => pick && add.mutate(pick)}>
                Add
              </Button>
            </Group>
          )}
        </Stack>
      )}
    </SectionCard>
  );
}

export default function ProfilePage() {
  const { accountId } = useSession();
  const id = accountId ?? '';
  const account = useQuery({ queryKey: ['account', id], queryFn: () => profileApi.account(id), enabled: !!id });
  const profile = useQuery({ queryKey: ['profile', 'creator', id], queryFn: () => profileApi.creatorProfile(id), enabled: !!id });

  return (
    <>
      <PageHeader title="Public profile" description="How shoppers and brands see you on StyleMint." />
      {account.isPending || profile.isPending ? (
        <ListSkeleton rows={4} height={80} />
      ) : account.error || profile.error ? (
        <ErrorBlock error={account.error ?? profile.error} onRetry={() => void Promise.all([account.refetch(), profile.refetch()])} title="Could not load your profile" />
      ) : (
        <Stack gap="md">
          {profile.data.status === 4 && (
            <Alert color="signal" variant="light" title="Your creator profile was not approved">
              {profile.data.rejectionReason ?? 'StyleMint did not give a reason.'}
            </Alert>
          )}
          <Header accountId={id} account={account.data} profile={profile.data} />
          <AboutForm accountId={id} account={account.data} profile={profile.data} />
          <Specializations accountId={id} />
        </Stack>
      )}
    </>
  );
}
