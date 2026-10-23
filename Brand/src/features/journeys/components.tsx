import type { ReactNode } from 'react';
import { Badge, Box, Card, Group, Image, ScrollArea, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconArrowRight, IconMovie, IconTools } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { isMissingEndpoint } from '../../api/client';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDate } from '../../lib/format';
import {
  hiddenReasonLabel,
  JOURNEYS_KEY,
  JourneyState,
  journeysApi,
  MIN_VISIBLE_STEPS,
  StepState,
  type JourneyReelOption,
  type JourneyStep,
  type VendorJourney,
} from './api';

/** Every journey endpoint 404s with no error code until the backend is deployed. */
export function JourneysSettingUp() {
  return (
    <Card withBorder data-testid="state-setting-up">
      <Stack align="center" gap={6} py="lg" ta="center">
        <IconTools size={28} opacity={0.6} aria-hidden />
        <Text fw={600}>Journeys are being set up</Text>
        <Text size="sm" c="dimmed" maw={480}>
          StyleMint is switching on collaborative journeys. You will be able to link your reels with other businesses here as
          soon as it is ready.
        </Text>
      </Stack>
    </Card>
  );
}

export function ReelThumb({ url, size = 64, label }: { url: string | null; size?: number; label?: string }) {
  const h = Math.round((size * 16) / 9);
  return url ? (
    <Image src={url} alt={label ?? ''} w={size} h={h} radius="md" fit="cover" style={{ flexShrink: 0 }} />
  ) : (
    <Box
      w={size}
      h={h}
      aria-hidden
      style={{ borderRadius: 8, background: 'var(--sm-surface-muted, var(--mantine-color-gray-1))', display: 'grid', placeItems: 'center', flexShrink: 0 }}
    >
      <IconMovie size={Math.max(16, size / 3)} opacity={0.45} />
    </Box>
  );
}

export function JourneyStateBadge({ journey }: { journey: Pick<VendorJourney, 'state' | 'isLive'> }) {
  if (journey.state === JourneyState.Ended)
    return (
      <Badge variant="light" color="gray" size="sm">
        Ended
      </Badge>
    );
  return journey.isLive ? (
    <Badge variant="light" color="forest" size="sm">
      Live in the feed
    </Badge>
  ) : (
    <Badge variant="light" color="amber" size="sm">
      Not live yet
    </Badge>
  );
}

export function StepStateBadge({ step }: { step: JourneyStep }) {
  if (step.state === StepState.Invited)
    return (
      <Badge variant="light" color="amber" size="sm">
        Invited
      </Badge>
    );
  if (step.isVisible)
    return (
      <Badge variant="light" color="forest" size="sm">
        Visible
      </Badge>
    );
  return (
    <Badge variant="light" color="gray" size="sm">
      {hiddenReasonLabel[step.hiddenReason] ?? 'Hidden'}
    </Badge>
  );
}

/** One line under the title: why the journey is or is not in the feed. */
export function liveExplanation(j: VendorJourney): string {
  if (j.state === JourneyState.Ended) return j.endedBy === 2 ? 'Ended by StyleMint.' : 'This journey has ended.';
  if (j.isLive) return `Buyers swipe through ${j.visibleStepCount} reels in this order.`;
  const missing = Math.max(0, MIN_VISIBLE_STEPS - j.visibleStepCount);
  return `Shows in the feed once ${missing === 1 ? 'one more business adds' : `${missing} more businesses add`} a published reel.`;
}

/** The step order as buyers will swipe it: reel thumbnail, position and business name. */
export function JourneyPreview({ steps }: { steps: JourneyStep[] }) {
  if (steps.length === 0) return <Text size="sm" c="dimmed">No steps yet.</Text>;
  return (
    <ScrollArea type="auto" offsetScrollbars>
      <Group gap={6} wrap="nowrap" align="center" data-testid="journey-preview" pb={4}>
        {steps.map((s, i) => (
          <Group key={s.id} gap={6} wrap="nowrap" align="center">
            <Stack
              gap={4}
              align="center"
              w={96}
              data-testid={`preview-step-${i + 1}`}
              style={{ opacity: s.isVisible ? 1 : 0.5 }}
              aria-label={`Step ${i + 1}: ${s.vendorName}${s.isVisible ? '' : ` (${hiddenReasonLabel[s.hiddenReason] ?? 'hidden'})`}`}
            >
              <ReelThumb url={s.thumbnailUrl} size={64} />
              <Text size="xs" fw={650} ta="center" lineClamp={2}>
                {i + 1}. {s.vendorName}
              </Text>
              {!s.isVisible && (
                <Text size="10px" c="dimmed" ta="center" lineClamp={2}>
                  {hiddenReasonLabel[s.hiddenReason] ?? 'Hidden'}
                </Text>
              )}
            </Stack>
            {i < steps.length - 1 && <IconArrowRight size={16} opacity={0.5} aria-hidden />}
          </Group>
        ))}
      </Group>
    </ScrollArea>
  );
}

export const myReelsKey = (journeyId?: string | null) => [...JOURNEYS_KEY, 'my-reels', journeyId ?? 'new'] as const;

/**
 * Pick one of my published reels (thumbnails). Reels already in 3 active journeys are shown but cannot be picked.
 * `currentReelId` marks the reel the step uses now (for "replace").
 */
export function ReelPicker({
  journeyId,
  value,
  onChange,
  currentReelId,
}: {
  journeyId?: string | null;
  value: string | null;
  onChange: (reelId: string) => void;
  currentReelId?: string | null;
}) {
  const q = useQuery({ queryKey: myReelsKey(journeyId), queryFn: () => journeysApi.myReels(journeyId) });
  if (q.isPending) return <ListSkeleton rows={2} height={90} />;
  if (isMissingEndpoint(q.error)) return <JourneysSettingUp />;
  if (q.error) return <ErrorBlock error={q.error} title="Could not load your reels" onRetry={() => void q.refetch()} />;
  const reels = q.data ?? [];
  if (reels.length === 0)
    return <EmptyBlock title="No published reels yet" body="Publish a reel from the seller app first, then add it to a journey." />;
  return (
    <SimpleGrid cols={{ base: 2, xs: 3, sm: 4 }} spacing="xs" role="group" aria-label="Your published reels">
      {reels.map((r) => (
        <ReelOption key={r.reelId} reel={r} selected={value === r.reelId} current={currentReelId === r.reelId} onPick={() => onChange(r.reelId)} />
      ))}
    </SimpleGrid>
  );
}

function ReelOption({ reel, selected, current, onPick }: { reel: JourneyReelOption; selected: boolean; current: boolean; onPick: () => void }) {
  const label = reel.caption?.trim() || `Reel from ${formatDate(reel.publishedAtUtc)}`;
  let note: ReactNode = null;
  if (!reel.canUse) note = reel.reason === 'journey.reel_limit' ? 'Already in 3 journeys' : 'Cannot be used';
  else if (current) note = 'In use now';
  else if (reel.journeyCount > 0) note = `In ${reel.journeyCount} ${reel.journeyCount === 1 ? 'journey' : 'journeys'}`;
  return (
    <UnstyledButton
      onClick={onPick}
      disabled={!reel.canUse}
      aria-pressed={selected}
      aria-label={`${label}${note ? ` (${note})` : ''}`}
      data-testid={`reel-option-${reel.reelId}`}
      style={{
        borderRadius: 12,
        padding: 6,
        border: `2px solid ${selected ? 'var(--mantine-color-forest-6)' : 'transparent'}`,
        opacity: reel.canUse ? 1 : 0.5,
        cursor: reel.canUse ? 'pointer' : 'not-allowed',
      }}
    >
      <Stack gap={4} align="center">
        <ReelThumb url={reel.thumbnailUrl} size={72} />
        <Text size="xs" lineClamp={2} ta="center">
          {label}
        </Text>
        {note && (
          <Text size="10px" c="dimmed" ta="center">
            {note}
          </Text>
        )}
      </Stack>
    </UnstyledButton>
  );
}
