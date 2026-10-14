import { useState } from 'react';
import { Alert, Avatar, Badge, Button, Card, Group, Select, Stack, Text } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDate } from '../../lib/format';
import { toastError, toastSuccess } from '../../lib/notify';
import type { Reel } from '../reels/api';
import { adherenceLabel, isDuplicateCitation, RecipeAdherence, StitchedState, studioApi } from './api';

function StitchedSuggestions({ reelId }: { reelId: string }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['studio', 'stitched', reelId], queryFn: () => studioApi.stitchedForReel(reelId) });
  const act = useMutation({
    mutationFn: ({ id, ack }: { id: string; ack: boolean }) => (ack ? studioApi.acknowledgeStitched(id) : studioApi.dismissStitched(id)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['studio', 'stitched', reelId] }),
    onError: (e) => toastError(e),
  });
  if (list.isPending) return <ListSkeleton rows={2} />;
  if (list.error) return <ErrorBlock error={list.error} onRetry={() => void list.refetch()} title="Could not load suggestions" />;
  const open = list.data.filter((s) => s.state !== StitchedState.Dismissed);
  if (open.length === 0) return <Text size="sm" c="dimmed">No stitch ideas for this reel right now.</Text>;
  return (
    <Stack gap="xs">
      {open.map((s) => (
        <Card key={s.id} padding="sm" withBorder>
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
              <Avatar src={s.candidateReelThumbnailUrl ?? undefined} radius="sm" size={44} />
              <div style={{ minWidth: 0 }}>
                <Text size="sm" fw={600} lineClamp={1}>
                  {s.candidateReelTitle ?? 'A reel by another creator'}
                </Text>
                <Text size="xs" c="dimmed">
                  {s.candidateCreatorDisplayName ? `by ${s.candidateCreatorDisplayName} · ` : ''}until {formatDate(s.expiresUtc)}
                </Text>
              </div>
            </Group>
            {s.state === StitchedState.Acknowledged ? (
              <Badge variant="light" color="forest">
                Saved
              </Badge>
            ) : (
              <Group gap={4} wrap="nowrap">
                <Button size="xs" variant="light" onClick={() => act.mutate({ id: s.id, ack: true })}>
                  Interested
                </Button>
                <Button size="xs" variant="subtle" color="gray" onClick={() => act.mutate({ id: s.id, ack: false })}>
                  Dismiss
                </Button>
              </Group>
            )}
          </Group>
        </Card>
      ))}
    </Stack>
  );
}

function RecipeCitation({ reel }: { reel: Reel }) {
  const recipes = useQuery({ queryKey: ['studio', 'recipes'], queryFn: studioApi.recipes });
  const [recipe, setRecipe] = useState<string | null>(null);
  const [adherence, setAdherence] = useState<string>(String(RecipeAdherence.Inspired));
  const [error, setError] = useState<string | null>(null);
  const cite = useMutation({
    mutationFn: () => {
      const all = [...(recipes.data?.fromTheBrand ?? []), ...(recipes.data?.generic ?? [])];
      const r = all.find((x) => x.recipeId === recipe)!;
      return studioApi.citeRecipe(reel.id, r.recipeId, r.recipeVersion, Number(adherence));
    },
    onSuccess: () => toastSuccess('Recipe credited on this reel'),
    onError: (e) => {
      if (isDuplicateCitation(e)) return; // already cited — nothing to say
      setError(e instanceof Error && /uncite/i.test(e.message) ? 'This reel already credits another recipe. Remove that first.' : (e as Error).message);
    },
  });
  const uncite = useMutation({
    mutationFn: () => studioApi.uncite(reel.id),
    onSuccess: () => toastSuccess('Recipe credit removed'),
    onError: (e) => toastError(e),
  });
  if (recipes.isPending) return <ListSkeleton rows={1} />;
  if (recipes.error) return <ErrorBlock error={recipes.error} onRetry={() => void recipes.refetch()} title="Could not load recipes" />;
  const options = [
    ...recipes.data.fromTheBrand.map((r) => ({ value: r.recipeId, label: `${r.title} (from a brand)` })),
    ...recipes.data.generic.map((r) => ({ value: r.recipeId, label: r.title })),
  ];
  if (options.length === 0) return <Text size="sm" c="dimmed">No reel recipes are available yet.</Text>;
  return (
    <Stack gap="sm" maw={520}>
      {error && (
        <Alert color="signal" variant="light">
          {error}
        </Alert>
      )}
      <Select label="Recipe you used" placeholder="Choose a recipe" data={options} value={recipe} onChange={setRecipe} searchable />
      <Select
        label="How closely"
        data={Object.entries(adherenceLabel).map(([value, label]) => ({ value, label }))}
        value={adherence}
        onChange={(v) => v && setAdherence(v)}
        allowDeselect={false}
      />
      <Group>
        <Button disabled={!recipe} loading={cite.isPending} onClick={() => cite.mutate()}>
          Credit recipe
        </Button>
        <Button variant="subtle" color="gray" loading={uncite.isPending} onClick={() => uncite.mutate()}>
          Remove credit
        </Button>
      </Group>
    </Stack>
  );
}

/** Ideas for one reel: stitch with other creators, credit the recipe it followed, products worth tagging. */
export function ReelIdeas({ reel }: { reel: Reel }) {
  const nudges = useQuery({ queryKey: ['studio', 'tag-nudges'], queryFn: () => studioApi.tagNudges(10) });
  const mine = (nudges.data ?? []).filter((n) => n.reelId === reel.id);
  return (
    <Stack gap="md">
      <SectionCard title="Products worth tagging" description="Suggested from what shoppers look at on your reels.">
        {nudges.isPending ? (
          <ListSkeleton rows={1} />
        ) : nudges.error ? (
          <ErrorBlock error={nudges.error} onRetry={() => void nudges.refetch()} />
        ) : mine.length === 0 ? (
          <EmptyBlock title="No suggestions for this reel" />
        ) : (
          <Stack gap={6}>
            {mine.map((n) => (
              <Text size="sm" key={n.suggestedProductId}>
                <b>{n.productName}</b> — {n.reason}
              </Text>
            ))}
          </Stack>
        )}
      </SectionCard>
      <SectionCard title="Stitch with another creator" description="Reels that share a product or a sound with this one.">
        <StitchedSuggestions reelId={reel.id} />
      </SectionCard>
      <SectionCard title="Credit a reel recipe" description="Followed a recipe? Crediting it helps brands see what works.">
        <RecipeCitation reel={reel} />
      </SectionCard>
    </Stack>
  );
}
