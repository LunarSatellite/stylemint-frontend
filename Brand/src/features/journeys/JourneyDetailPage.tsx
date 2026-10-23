import { useState } from 'react';
import { ActionIcon, Alert, Avatar, Badge, Button, Card, Group, Loader, Modal, Stack, Text, Textarea, TextInput, Tooltip, UnstyledButton } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconDoorExit,
  IconGripVertical,
  IconPencil,
  IconPlayerStop,
  IconRefresh,
  IconTrash,
  IconUserPlus,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, isMissingEndpoint } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDateTime, initialsOf } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import {
  CITY_MAX,
  JOURNEYS_KEY,
  journeyErrorMessage,
  journeyPermissions,
  journeysApi,
  journeyTitle,
  moveStep,
  NOTE_MAX,
  placeStep,
  sameOrder,
  StepState,
  TITLE_MAX,
  validateJourneyText,
  vendorCategoryLabel,
  type JourneyStep,
  type JourneyVendor,
  type VendorJourney,
} from './api';
import { JourneyPreview, JourneysSettingUp, JourneyStateBadge, liveExplanation, myReelsKey, ReelPicker, ReelThumb, StepStateBadge } from './components';

export const detailKey = (id: string) => [...JOURNEYS_KEY, 'detail', id] as const;

/** Run a journey write: keep the returned journey, refresh the list, toast; show the mapped error on failure. */
function useJourneyWrite(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (w: { run: () => Promise<VendorJourney | void>; success: string; after?: () => void }) => {
      const result = await w.run();
      return { result, w };
    },
    onSuccess: ({ result, w }) => {
      if (result && typeof result === 'object' && 'steps' in result) queryClient.setQueryData(detailKey(id), result);
      void queryClient.invalidateQueries({ queryKey: [...JOURNEYS_KEY, 'list'] });
      void queryClient.invalidateQueries({ queryKey: myReelsKey(id) });
      toastSuccess(w.success);
      w.after?.();
    },
    onError: (error) => {
      toastError(new Error(journeyErrorMessage(error)));
      if (error instanceof ApiError && (error.code === 'state.concurrency_conflict' || error.code === 'journey.order_mismatch' || error.code === 'journey.invalid_step_state'))
        void queryClient.invalidateQueries({ queryKey: detailKey(id) });
    },
  });
}

export default function JourneyDetailPage() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: detailKey(id), queryFn: () => journeysApi.get(id), enabled: !!id });
  const back = { to: '/journeys', label: 'Journeys' };
  if (q.isPending)
    return (
      <>
        <PageHeader title="Journey" back={back} />
        <ListSkeleton rows={3} height={90} />
      </>
    );
  if (q.error || !q.data) {
    const notFound = q.error instanceof ApiError && q.error.status === 404 && !!q.error.code;
    return (
      <>
        <PageHeader title="Journey" back={back} />
        {isMissingEndpoint(q.error) ? (
          <JourneysSettingUp />
        ) : notFound ? (
          <Card>
            <EmptyBlock title="Journey not found" body="It may have ended, or your business is no longer part of it." />
          </Card>
        ) : (
          <ErrorBlock error={q.error} title="Could not load this journey" onRetry={() => void q.refetch()} />
        )}
      </>
    );
  }
  return <JourneyBody j={q.data} />;
}

function JourneyBody({ j }: { j: VendorJourney }) {
  const navigate = useNavigate();
  const perms = journeyPermissions(j);
  const write = useJourneyWrite(j.id);
  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const title = journeyTitle(j);
  const stepIds = j.steps.map((s) => s.id);

  const reorder = (next: string[]) => {
    if (sameOrder(next, stepIds)) return;
    write.mutate({ run: () => journeysApi.reorder(j.id, next), success: 'Order saved.' });
  };

  const endJourney = async () => {
    const ok = await confirmAction({
      title: 'End this journey?',
      body: 'The journey disappears from the feed for good and every business in it is told. Your reels stay published on their own. This cannot be undone.',
      confirmLabel: 'End journey',
      danger: true,
    });
    if (ok) write.mutate({ run: () => journeysApi.end(j.id), success: 'Journey ended.' });
  };

  const leave = async () => {
    const ok = await confirmAction({
      title: 'Leave this journey?',
      body: `Your step disappears from “${title}” and ${j.ownerName} is told. To come back you need a new invitation.`,
      confirmLabel: 'Leave journey',
      danger: true,
    });
    if (ok) write.mutate({ run: () => journeysApi.leave(j.id), success: 'You left the journey.', after: () => navigate('/journeys') });
  };

  const remove = async (s: JourneyStep) => {
    const invite = s.state === StepState.Invited;
    const ok = await confirmAction({
      title: invite ? `Cancel the invitation to ${s.vendorName}?` : `Remove ${s.vendorName} from the journey?`,
      body: invite ? 'They can no longer join with this invitation.' : 'Their reel is taken out of the journey and they are told.',
      confirmLabel: invite ? 'Cancel invitation' : 'Remove step',
      danger: true,
    });
    if (ok) write.mutate({ run: () => journeysApi.removeStep(j.id, s.id), success: invite ? 'Invitation cancelled.' : 'Step removed.' });
  };

  return (
    <>
      <PageHeader
        title={title}
        back={{ to: '/journeys', label: 'Journeys' }}
        description={liveExplanation(j)}
        meta={
          <Group gap={6}>
            <JourneyStateBadge journey={j} />
            {j.city && (
              <Badge variant="outline" color="gray" size="sm">
                {j.city}
              </Badge>
            )}
            <Text size="xs" c="dimmed">
              Started by {j.ownerName}
            </Text>
          </Group>
        }
        actions={
          <>
            {perms.canEdit && (
              <Button variant="default" leftSection={<IconPencil size={16} />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {perms.canInvite && (
              <Button leftSection={<IconUserPlus size={16} />} onClick={() => setInviting(true)}>
                Invite a business
              </Button>
            )}
            {perms.canLeave && (
              <Button variant="light" color="signal" leftSection={<IconDoorExit size={16} />} onClick={() => void leave()}>
                Leave
              </Button>
            )}
            {perms.canEnd && (
              <Button variant="light" color="signal" leftSection={<IconPlayerStop size={16} />} onClick={() => void endJourney()}>
                End journey
              </Button>
            )}
          </>
        }
      />
      <Stack gap="lg">
        {!perms.active && (
          <Alert variant="light" color="gray" title={j.endedBy === 2 ? 'Ended by StyleMint' : 'This journey has ended'}>
            <Text size="sm">
              {j.endedUtc ? `Ended ${formatDateTime(j.endedUtc)}. ` : ''}
              {j.endReason ? `Reason: ${j.endReason}` : 'It no longer shows in the feed and cannot be changed.'}
            </Text>
          </Alert>
        )}
        {perms.canRespond && perms.myStep && <InvitePanel j={j} step={perms.myStep} />}
        <SectionCard title="Preview" description="The order buyers swipe through. Faded steps are not shown to buyers yet.">
          <JourneyPreview steps={j.steps} />
        </SectionCard>
        <SectionCard
          title={`Steps (${j.steps.length} of ${j.maxSteps})`}
          description={perms.canReorder ? 'Drag a step, or use the arrows, to change the order.' : undefined}
          action={
            perms.canReplaceReel && (
              <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={() => setReplacing(true)}>
                Replace my reel
              </Button>
            )
          }
        >
          <StepList j={j} busy={write.isPending} onReorder={reorder} onRemove={(s) => void remove(s)} />
        </SectionCard>
      </Stack>
      {perms.canEdit && editing && <EditModal j={j} opened onClose={() => setEditing(false)} />}
      {perms.canInvite && <InviteModal j={j} opened={inviting} onClose={() => setInviting(false)} />}
      {perms.canReplaceReel && perms.myStep && <ReplaceReelModal j={j} step={perms.myStep} opened={replacing} onClose={() => setReplacing(false)} />}
    </>
  );
}

function StepList({ j, busy, onReorder, onRemove }: { j: VendorJourney; busy: boolean; onReorder: (ids: string[]) => void; onRemove: (s: JourneyStep) => void }) {
  const perms = journeyPermissions(j);
  const ids = j.steps.map((s) => s.id);
  const [dragging, setDragging] = useState<string | null>(null);
  return (
    <Stack gap="xs" role="list" aria-label="Journey steps">
      {j.steps.map((s, i) => {
        const mine = s.id === j.myStepId;
        return (
          <Card
            key={s.id}
            withBorder
            padding="xs"
            role="listitem"
            data-testid={`step-${s.id}`}
            draggable={perms.canReorder && !busy}
            onDragStart={(e) => {
              setDragging(s.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              if (dragging) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging) onReorder(placeStep(ids, dragging, i));
              setDragging(null);
            }}
            onDragEnd={() => setDragging(null)}
            style={{ opacity: dragging === s.id ? 0.5 : 1 }}
          >
            <Group wrap="nowrap" gap="sm" align="center">
              {perms.canReorder && <IconGripVertical size={16} opacity={0.4} aria-hidden style={{ cursor: 'grab', flexShrink: 0 }} />}
              <Text fw={650} w={20} ta="center">
                {i + 1}
              </Text>
              <ReelThumb url={s.thumbnailUrl} size={40} />
              <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                <Group gap={6} wrap="nowrap">
                  <Avatar src={s.vendorLogoUrl} size={20} radius="xl">
                    {initialsOf(s.vendorName)}
                  </Avatar>
                  <Text fw={600} size="sm" truncate>
                    {s.vendorName}
                    {mine ? ' (you)' : ''}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {s.state === StepState.Invited ? (s.inviteNote ? `Invited: “${s.inviteNote}”` : `Invited ${formatDateTime(s.invitedUtc)}`) : s.caption || 'Reel'}
                </Text>
              </Stack>
              <StepStateBadge step={s} />
              {perms.canReorder && (
                <Group gap={2} wrap="nowrap">
                  <Tooltip label="Move up">
                    <ActionIcon variant="subtle" color="gray" aria-label={`Move ${s.vendorName} up`} disabled={busy || i === 0} onClick={() => onReorder(moveStep(ids, s.id, -1))}>
                      <IconArrowUp size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Move down">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label={`Move ${s.vendorName} down`}
                      disabled={busy || i === j.steps.length - 1}
                      onClick={() => onReorder(moveStep(ids, s.id, 1))}
                    >
                      <IconArrowDown size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              )}
              {perms.canRemove(s) && (
                <Tooltip label={s.state === StepState.Invited ? 'Cancel invitation' : 'Remove step'}>
                  <ActionIcon variant="subtle" color="signal" aria-label={`Remove ${s.vendorName}`} disabled={busy} onClick={() => onRemove(s)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Card>
        );
      })}
    </Stack>
  );
}

/** An invitation to me: pick one of my reels and accept, or decline. */
function InvitePanel({ j, step }: { j: VendorJourney; step: JourneyStep }) {
  const navigate = useNavigate();
  const write = useJourneyWrite(j.id);
  const [reelId, setReelId] = useState<string | null>(null);
  const decline = async () => {
    const ok = await confirmAction({
      title: 'Decline the invitation?',
      body: `${j.ownerName} is told you declined. You can only join later with a new invitation.`,
      confirmLabel: 'Decline',
      danger: true,
    });
    if (ok) write.mutate({ run: () => journeysApi.decline(j.id, step.id), success: 'Invitation declined.', after: () => navigate('/journeys') });
  };
  return (
    <SectionCard title={`${j.ownerName} invited you`} description="Pick one of your published reels to add as your step. Buyers will see it in this journey's order.">
      <Stack gap="sm">
        {step.inviteNote && (
          <Text size="sm" fs="italic">
            “{step.inviteNote}”
          </Text>
        )}
        <ReelPicker journeyId={j.id} value={reelId} onChange={setReelId} />
        <Group justify="flex-end">
          <Button variant="default" color="signal" leftSection={<IconX size={16} />} disabled={write.isPending} onClick={() => void decline()}>
            Decline
          </Button>
          <Button
            leftSection={<IconCheck size={16} />}
            disabled={!reelId}
            loading={write.isPending}
            onClick={() => write.mutate({ run: () => journeysApi.accept(j.id, step.id, reelId!), success: 'You joined the journey.' })}
          >
            Accept with this reel
          </Button>
        </Group>
      </Stack>
    </SectionCard>
  );
}

function ReplaceReelModal({ j, step, opened, onClose }: { j: VendorJourney; step: JourneyStep; opened: boolean; onClose: () => void }) {
  const write = useJourneyWrite(j.id);
  const [reelId, setReelId] = useState<string | null>(null);
  const close = () => {
    setReelId(null);
    onClose();
  };
  return (
    <Modal opened={opened} onClose={close} title="Replace my reel" size="lg">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Your step keeps its place in the journey; buyers see the new reel instead.
        </Text>
        {opened && <ReelPicker journeyId={j.id} value={reelId} onChange={setReelId} currentReelId={step.reelId} />}
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!reelId || reelId === step.reelId}
            loading={write.isPending}
            onClick={() => write.mutate({ run: () => journeysApi.replaceReel(j.id, step.id, reelId!), success: 'Reel replaced.', after: close })}
          >
            Use this reel
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function EditModal({ j, opened, onClose }: { j: VendorJourney; opened: boolean; onClose: () => void }) {
  const write = useJourneyWrite(j.id);
  const [title, setTitle] = useState(j.title ?? '');
  const [city, setCity] = useState(j.city ?? '');
  const invalid = validateJourneyText(title, city);
  return (
    <Modal opened={opened} onClose={onClose} title="Edit journey">
      <Stack gap="md">
        <TextInput label="Title (optional)" value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.currentTarget.value)} />
        <TextInput label="City (optional)" value={city} maxLength={CITY_MAX} onChange={(e) => setCity(e.currentTarget.value)} />
        {invalid && (
          <Text size="sm" c="signal">
            {invalid}
          </Text>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!!invalid}
            loading={write.isPending}
            onClick={() =>
              write.mutate({ run: () => journeysApi.update(j.id, { title: title.trim() || null, city: city.trim() || null }), success: 'Journey saved.', after: onClose })
            }
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Search approved businesses by name (≥ 2 characters) or exact vendor id, then invite one with an optional note. */
function InviteModal({ j, opened, onClose }: { j: VendorJourney; opened: boolean; onClose: () => void }) {
  const write = useJourneyWrite(j.id);
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search.trim(), 300);
  const [picked, setPicked] = useState<JourneyVendor | null>(null);
  const [note, setNote] = useState('');
  const inJourney = new Set(j.steps.map((s) => s.vendorAccountId));
  const results = useQuery({
    queryKey: [...JOURNEYS_KEY, 'vendors', debounced],
    queryFn: () => journeysApi.searchVendors(debounced),
    enabled: opened && debounced.length >= 2,
  });
  const close = () => {
    setSearch('');
    setPicked(null);
    setNote('');
    onClose();
  };
  return (
    <Modal opened={opened} onClose={close} title="Invite a business" size="lg">
      <Stack gap="md">
        {picked ? (
          <Card withBorder padding="sm">
            <Group justify="space-between" wrap="nowrap">
              <VendorLine v={picked} />
              <Button size="xs" variant="subtle" onClick={() => setPicked(null)}>
                Change
              </Button>
            </Group>
          </Card>
        ) : (
          <>
            <TextInput label="Business name" placeholder="Hotel Barahi" value={search} onChange={(e) => setSearch(e.currentTarget.value)} data-autofocus />
            {debounced.length < 2 ? (
              <Text size="sm" c="dimmed">
                Type at least 2 letters of the business name.
              </Text>
            ) : results.isPending ? (
              <Loader size="sm" color="forest" />
            ) : results.error ? (
              <ErrorBlock error={results.error} title="Could not search businesses" onRetry={() => void results.refetch()} />
            ) : (results.data ?? []).length === 0 ? (
              <Text size="sm" c="dimmed">
                No business matches “{debounced}”.
              </Text>
            ) : (
              <Stack gap={4} role="list" aria-label="Matching businesses">
                {(results.data ?? []).map((v) => {
                  const already = inJourney.has(v.vendorAccountId);
                  return (
                    <UnstyledButton
                      key={v.vendorAccountId}
                      role="listitem"
                      disabled={already}
                      onClick={() => setPicked(v)}
                      aria-label={`${v.businessName}${already ? ' (already in this journey)' : ''}`}
                      style={{ padding: 8, borderRadius: 8, opacity: already ? 0.5 : 1 }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <VendorLine v={v} />
                        {already && (
                          <Text size="xs" c="dimmed">
                            Already in
                          </Text>
                        )}
                      </Group>
                    </UnstyledButton>
                  );
                })}
              </Stack>
            )}
          </>
        )}
        <Textarea
          label="Note (optional)"
          description={`Shown to the business with the invitation. ${note.length}/${NOTE_MAX}`}
          placeholder="Join our Pokhara weekend?"
          value={note}
          maxLength={NOTE_MAX}
          autosize
          minRows={2}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!picked}
            loading={write.isPending}
            onClick={() =>
              write.mutate({
                run: () => journeysApi.invite(j.id, { vendorAccountId: picked!.vendorAccountId, note: note.trim() || null }),
                success: `Invitation sent to ${picked!.businessName}.`,
                after: close,
              })
            }
          >
            Send invitation
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function VendorLine({ v }: { v: JourneyVendor }) {
  return (
    <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
      <Avatar src={v.logoUrl} size={32} radius="xl">
        {initialsOf(v.businessName)}
      </Avatar>
      <Stack gap={0} style={{ minWidth: 0 }}>
        <Text size="sm" fw={600} truncate>
          {v.businessName}
          {v.isVerified ? ' ✓' : ''}
        </Text>
        <Text size="xs" c="dimmed" truncate>
          {[vendorCategoryLabel[v.category] ?? 'Business', v.city].filter(Boolean).join(' · ')}
        </Text>
      </Stack>
    </Group>
  );
}
