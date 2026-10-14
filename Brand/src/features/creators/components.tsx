import { useState, type ReactNode } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Drawer,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { IconCircleCheck, IconSearch } from '@tabler/icons-react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router-dom';
import { ApiError, messageOf } from '../../api/client';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { initialsOf } from '../../lib/format';
import { toastSuccess } from '../../lib/notify';
import { useIsPhone } from '../../lib/useIsPhone';
import { creatorsApi, type CreatorPick } from './api';
import { compactCount, shortCreator, toFraction } from './labels';

/** Every creators query key starts with this. */
export const CREATORS_KEY = 'creators';

export const CREATOR_AREAS = [
  { to: '/creators/find', label: 'Find creators', short: 'Find' },
  { to: '/creators/partnerships', label: 'Partnerships', short: 'Partnerships' },
  { to: '/creators/agreements', label: 'Agreements & contracts', short: 'Agreements' },
  { to: '/creators/campaigns', label: 'Briefs & campaigns', short: 'Campaigns' },
  { to: '/creators/retainers', label: 'Retainers & squads', short: 'Retainers' },
  { to: '/creators/approvals', label: 'Content approvals', short: 'Approvals' },
  { to: '/creators/payments', label: 'Payments to creators', short: 'Payments' },
] as const;

/** Phone: chips to hop between creator sections (the sidebar is behind "More" there). */
function CreatorsSubNav() {
  return (
    <Box hiddenFrom="sm" mb="md">
      <ScrollArea type="never">
        <Box component="nav" aria-label="Creator sections">
          <Group gap={6} wrap="nowrap">
            {CREATOR_AREAS.map((a) => (
              <NavLink key={a.to} to={a.to} className="sm-crm-chip">
                {a.short}
              </NavLink>
            ))}
          </Group>
        </Box>
      </ScrollArea>
    </Box>
  );
}

export function CreatorsLayout() {
  return (
    <>
      <CreatorsSubNav />
      <Outlet />
    </>
  );
}

/** Detail panel: a bottom sheet on a phone, a side panel on larger screens. */
export function DetailSheet({
  opened,
  onClose,
  title,
  children,
}: {
  opened: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  const phone = useIsPhone();
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={<Text fw={650}>{title}</Text>}
      position={phone ? 'bottom' : 'right'}
      size={phone ? '88%' : 'lg'}
      radius={phone ? 'lg' : 0}
      padding="md"
      zIndex={300}
      scrollAreaComponent={ScrollArea.Autosize}
    >
      {children}
    </Drawer>
  );
}

/** A creator's public name, looked up once and cached. Falls back to a short id — never an error. */
export function useCreatorName(accountId: string | null | undefined, known?: string | null) {
  const q = useQuery({
    queryKey: [CREATORS_KEY, 'profile', accountId],
    queryFn: () => creatorsApi.profile(accountId!),
    enabled: !!accountId && !known,
    staleTime: 10 * 60_000,
    retry: false,
  });
  return {
    name: known || q.data?.displayName || shortCreator(accountId),
    handle: q.data?.handle ?? null,
    avatarUrl: q.data?.avatarUrl ?? null,
    verified: q.data?.isVerified ?? false,
  };
}

export function CreatorLine({
  accountId,
  name,
  handle,
  avatarUrl,
  size = 34,
  extra,
}: {
  accountId: string | null | undefined;
  name?: string | null;
  handle?: string | null;
  avatarUrl?: string | null;
  size?: number;
  extra?: ReactNode;
}) {
  const looked = useCreatorName(accountId, name);
  const shownHandle = handle ?? looked.handle;
  return (
    <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
      <Avatar size={size} radius="xl" color="forest" src={avatarUrl ?? looked.avatarUrl ?? undefined}>
        {initialsOf(looked.name)}
      </Avatar>
      <div style={{ minWidth: 0 }}>
        <Group gap={4} wrap="nowrap">
          <Text size="sm" fw={600} truncate>
            {looked.name}
          </Text>
          {looked.verified && <IconCircleCheck size={15} color="var(--mantine-color-forest-6)" aria-label="Verified" />}
        </Group>
        {(shownHandle || extra) && (
          <Text size="xs" c="dimmed" truncate>
            {shownHandle ? `@${shownHandle.replace(/^@/, '')}` : null}
            {shownHandle && extra ? ' · ' : null}
            {extra}
          </Text>
        )}
      </div>
    </Group>
  );
}

/** Asks for a reason before a step the other side will see (end, decline, terminate, reject). */
export function ReasonModal({
  opened,
  onClose,
  title,
  intro,
  label = 'Reason',
  required = true,
  confirmLabel,
  danger,
  onConfirm,
  maxLength = 200,
}: {
  opened: boolean;
  onClose: () => void;
  title: string;
  intro: ReactNode;
  label?: string;
  required?: boolean;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (reason: string) => Promise<unknown>;
  maxLength?: number;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: () => onConfirm(reason.trim()),
    onSuccess: () => {
      setReason('');
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const submit = () => {
    setError(null);
    if (required && !reason.trim()) return setError('Please give a reason. The creator will see it.');
    run.mutate();
  };
  return (
    <Modal opened={opened} onClose={onClose} title={title} zIndex={400}>
      <Stack gap="md">
        <Text size="sm">{intro}</Text>
        {error && (
          <Alert color="signal" variant="light" role="alert">
            {error}
          </Alert>
        )}
        <Textarea
          label={label}
          autosize
          minRows={2}
          maxLength={maxLength}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          data-autofocus
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button color={danger ? 'signal' : 'forest'} loading={run.isPending} onClick={submit}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function PickCard({ c, onPick }: { c: CreatorPick; onPick: (c: CreatorPick) => void }) {
  return (
    <Card withBorder padding="sm">
      <Stack gap={8}>
        <CreatorLine accountId={c.creatorAccountId} name={c.displayName} handle={c.handle} avatarUrl={c.avatarUrl} />
        <Group gap={4}>
          {c.followerCount !== null && (
            <Badge variant="light" color="slate" size="sm">
              {compactCount(c.followerCount)} followers
            </Badge>
          )}
          {c.niches.slice(0, 3).map((n) => (
            <Badge key={n} variant="outline" color="slate" size="sm">
              {n}
            </Badge>
          ))}
        </Group>
        <Button size="xs" variant="light" onClick={() => onPick(c)}>
          Choose
        </Button>
      </Stack>
    </Card>
  );
}

/** Search creators to invite — a modal step before the terms form. */
export function CreatorSearch({ onPick, excludePartnered = true }: { onPick: (c: CreatorPick) => void; excludePartnered?: boolean }) {
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q, 300);
  const results = useQuery({
    queryKey: [CREATORS_KEY, 'search', debounced, excludePartnered],
    queryFn: () => creatorsApi.searchCreators(debounced, null, null, excludePartnered),
    placeholderData: keepPreviousData,
  });
  return (
    <Stack gap="sm">
      <TextInput
        leftSection={<IconSearch size={16} />}
        placeholder="Search by name, handle or style"
        aria-label="Search creators"
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
      />
      {results.isPending ? (
        <ListSkeleton rows={3} height={90} />
      ) : results.error ? (
        <ErrorBlock error={results.error} title="Could not search creators" onRetry={() => void results.refetch()} />
      ) : !results.data?.items.length ? (
        <EmptyBlock title="No creators found" body={excludePartnered ? 'Creators you already work with are hidden here.' : undefined} />
      ) : (
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          {results.data.items.map((c) => (
            <PickCard key={c.creatorAccountId} c={c} onPick={onPick} />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}

/**
 * Invite a creator to partner: commission range (%), optional brief. The creator sees the invite and
 * your published partnership terms, and accepts or declines.
 */
export function InviteModal({
  opened,
  onClose,
  creator,
  defaults,
}: {
  opened: boolean;
  onClose: () => void;
  /** Preselected creator (from Find creators / a match). Without it, the modal starts with search. */
  creator?: { accountId: string; name: string | null } | null;
  defaults?: { minPercent?: number; maxPercent?: number; brandBriefId?: string | null };
}) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<{ accountId: string; name: string | null } | null>(creator ?? null);
  const [min, setMin] = useState<number>(defaults?.minPercent ?? 10);
  const [max, setMax] = useState<number>(defaults?.maxPercent ?? 15);
  const [briefId, setBriefId] = useState<string | null>(defaults?.brandBriefId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [needsTerms, setNeedsTerms] = useState(false);
  const [editingTerms, setEditingTerms] = useState(false);
  const briefs = useQuery({
    queryKey: [CREATORS_KEY, 'briefs', 'locked'],
    queryFn: () => creatorsApi.briefs([2], null),
    enabled: opened && !!picked,
  });
  const invite = useMutation({
    mutationFn: () =>
      creatorsApi.invite({
        creatorProfileId: picked!.accountId,
        commissionMinPercent: toFraction(min),
        commissionMaxPercent: toFraction(max),
        brandBriefId: briefId,
      }),
    onSuccess: () => {
      toastSuccess('Invitation sent. The creator will be notified.');
      void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'partnerships'] });
      onClose();
    },
    onError: (e) => (needsProgramTerms(e) ? setNeedsTerms(true) : setError(messageOf(e))),
  });
  const submit = () => {
    setError(null);
    if (!picked) return setError('Choose a creator first.');
    if (!(min >= 0 && min <= 100 && max >= 0 && max <= 100)) return setError('Commission must be between 0% and 100%.');
    if (max < min) return setError('The highest commission cannot be lower than the lowest.');
    invite.mutate();
  };
  return (
    <Modal opened={opened} onClose={onClose} title="Invite a creator" size="lg">
      {!picked ? (
        <CreatorSearch onPick={(c) => setPicked({ accountId: c.creatorAccountId, name: c.displayName })} />
      ) : (
        <Stack gap="md">
          {needsTerms && (
            <Alert color="amber" variant="light" title="Publish your program terms first" data-testid="needs-terms">
              <Stack gap="xs" align="flex-start">
                <Text size="sm">Creators see who can join and your content rules with every invitation.</Text>
                <Button size="xs" variant="light" color="amber" onClick={() => setEditingTerms(true)}>
                  Write program terms
                </Button>
              </Stack>
            </Alert>
          )}
          {error && (
            <Alert color="signal" variant="light" role="alert">
              {error}
            </Alert>
          )}
          <Group justify="space-between" wrap="nowrap">
            <CreatorLine accountId={picked.accountId} name={picked.name} />
            {!creator && (
              <Button variant="subtle" size="xs" onClick={() => setPicked(null)}>
                Change
              </Button>
            )}
          </Group>
          <SimpleGrid cols={2} spacing="sm">
            <NumberInput label="Lowest commission (%)" min={0} max={100} decimalScale={1} value={min} onChange={(v) => setMin(Number(v) || 0)} />
            <NumberInput label="Highest commission (%)" min={0} max={100} decimalScale={1} value={max} onChange={(v) => setMax(Number(v) || 0)} />
          </SimpleGrid>
          <Select
            label="Campaign brief (optional)"
            placeholder={briefs.isPending ? 'Loading briefs…' : 'No brief'}
            clearable
            data={(briefs.data?.items ?? []).map((b) => ({ value: b.id, label: b.title }))}
            value={briefId}
            onChange={setBriefId}
          />
          <Text size="xs" c="dimmed">
            The creator earns a commission in this range on sales from their reels. They see your published partnership terms
            with the invitation. You can put the full deal in writing under Agreements once they accept.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} loading={invite.isPending}>
              Send invitation
            </Button>
          </Group>
        </Stack>
      )}
      {editingTerms && (
        <ProgramTermsModal
          onClose={() => setEditingTerms(false)}
          onPublished={() => {
            setEditingTerms(false);
            setNeedsTerms(false);
          }}
        />
      )}
    </Modal>
  );
}

/** "Rs …" amount + currency input row, used by retainer/squad forms. */
export function AmountInput({ label, value, onChange, description }: { label: string; value: number; onChange: (n: number) => void; description?: string }) {
  return (
    <NumberInput
      label={label}
      description={description}
      min={0}
      thousandSeparator=","
      decimalScale={2}
      prefix="Rs "
      value={value}
      onChange={(v) => onChange(Number(v) || 0)}
    />
  );
}

/**
 * `confirmAction` from lib/notify, raised above the detail sheet (z 300) and reason dialogs (z 400):
 * the shared one opens at Mantine's default z-index and would hide behind an open sheet.
 */
export function confirmAction(opts: { title: string; body: ReactNode; confirmLabel: string; danger?: boolean; cancelLabel?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (v: boolean) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    modals.openConfirmModal({
      title: opts.title,
      zIndex: 500,
      children: typeof opts.body === 'string' ? <Text size="sm">{opts.body}</Text> : opts.body,
      labels: { confirm: opts.confirmLabel, cancel: opts.cancelLabel ?? 'Cancel' },
      confirmProps: { color: opts.danger ? 'signal' : 'forest' },
      onConfirm: () => settle(true),
      onCancel: () => settle(false),
      onClose: () => settle(false),
    });
  });
}

/** The invite was refused because the shop has not published program terms yet. */
export function needsProgramTerms(e: unknown): boolean {
  return e instanceof ApiError && e.status === 400 && (e.problem?.field === 'vendorProfileId' || /publish partnership terms/i.test(e.message));
}

const DEFAULT_WHO = ['Creators on StyleMint whose style fits our shop', 'Honest reviews — say what you really think'];
const DEFAULT_RULES = ['Tag the exact product shown in the reel', 'Show the product clearly in good light', 'No misleading claims about price or quality'];

/**
 * The shop's program terms: who can join and the content rules. Creators see them with every
 * invitation; the backend needs them before the first invite. Publishing makes a new version.
 */
export function ProgramTermsModal({ onClose, onPublished }: { onClose: () => void; onPublished?: () => void }) {
  const [who, setWho] = useState(DEFAULT_WHO.join('\n'));
  const [rules, setRules] = useState(DEFAULT_RULES.join('\n'));
  const [error, setError] = useState<string | null>(null);
  const split = (s: string) =>
    s
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
  const publish = useMutation({
    mutationFn: () => creatorsApi.publishTerms(split(who), split(rules)),
    onSuccess: () => {
      toastSuccess('Program terms published. Creators see them with your invitations.');
      onPublished?.();
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });
  return (
    <Modal opened onClose={onClose} title="Program terms" size="lg" zIndex={400}>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          One line per point. Publishing replaces your current terms for new invitations; existing partnerships keep the terms they joined
          under.
        </Text>
        {error && (
          <Alert color="signal" variant="light" role="alert">
            {error}
          </Alert>
        )}
        <Textarea label="Who can join" autosize minRows={3} value={who} onChange={(e) => setWho(e.currentTarget.value)} />
        <Textarea label="Content rules" autosize minRows={3} value={rules} onChange={(e) => setRules(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={publish.isPending}
            onClick={() => {
              setError(null);
              if (!split(who).length || !split(rules).length) return setError('Add at least one point to each list.');
              if (split(who).length > 20 || split(rules).length > 30) return setError('Keep it to 20 joining points and 30 content rules.');
              publish.mutate();
            }}
          >
            Publish terms
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
