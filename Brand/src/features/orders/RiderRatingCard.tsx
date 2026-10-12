import { useEffect, useState } from 'react';
import { Alert, Button, Chip, Group, Rating, Stack, Text, Textarea } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, messageOf } from '../../api/client';
import { SectionCard } from '../../components/SectionCard';
import { formatDate } from '../../lib/format';
import { toastSuccess } from '../../lib/notify';
import { NEGATIVE_TAGS, ordersApi, POSITIVE_TAGS, tagLabel, type RiderRatingTag, type SubOrderDetail } from './api';

/** "Rate the rider" after a StyleMint rider picked up (rider-rating-contract.md). Hidden if unsupported. */
export function RiderRatingCard({ order }: { order: SubOrderDetail }) {
  const canRate = order.canRateRider ?? order.delivery?.canRateRider ?? false;
  const existingSummary = order.riderRating ?? order.delivery?.riderRating ?? null;
  const show = canRate || !!existingSummary;
  const qc = useQueryClient();
  const rating = useQuery({
    queryKey: ['order', order.id, 'rider-rating'],
    queryFn: () => ordersApi.riderRating(order.id),
    enabled: show,
  });
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rating.data) {
      setStars(rating.data.stars);
      setTags(rating.data.tags);
      setComment(rating.data.comment ?? '');
    }
  }, [rating.data]);

  const save = useMutation({
    mutationFn: () => ordersApi.rateRider(order.id, { stars, tags: tags as RiderRatingTag[], comment: comment.trim() || null }),
    onSuccess: (data) => {
      qc.setQueryData(['order', order.id, 'rider-rating'], data);
      void qc.invalidateQueries({ queryKey: ['order', order.id] });
      setEditing(false);
      setError(null);
      toastSuccess('Thanks — your rating helps other sellers.');
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'rider_rating.window_closed') setError('Ratings can only be changed for 7 days after pickup.');
      else if (e instanceof ApiError && e.code === 'rider_rating.not_eligible') setError('This order cannot be rated.');
      else setError(messageOf(e));
    },
  });

  if (!show) return null;
  const existing = rating.data;
  const editable = canRate && (!existing || Date.parse(existing.editableUntilUtc) > Date.now());
  const showForm = editable && (!existing || editing);

  return (
    <SectionCard title="Rate the rider" description={existing ? `You rated ${existing.riderName}` : 'How was the pickup?'}>
      {error && (
        <Alert color="signal" variant="light" mb="sm">
          {error}
        </Alert>
      )}
      {showForm ? (
        <Stack gap="sm">
          <Rating value={stars} onChange={setStars} size="lg" aria-label="Stars" />
          <Chip.Group multiple value={tags} onChange={(v) => setTags(v.slice(0, 4))}>
            <Group gap={6}>
              {[...POSITIVE_TAGS, ...NEGATIVE_TAGS].map((t) => (
                <Chip key={t} value={t} size="xs" color={NEGATIVE_TAGS.includes(t) ? 'signal' : 'forest'} disabled={!tags.includes(t) && tags.length >= 4}>
                  {tagLabel[t]}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
          <Textarea placeholder="Anything else? (optional)" maxLength={300} autosize minRows={2} value={comment} onChange={(e) => setComment(e.currentTarget.value)} />
          <Group justify="flex-end">
            {existing && (
              <Button variant="default" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
            <Button disabled={stars < 1} loading={save.isPending} onClick={() => save.mutate()}>
              {existing ? 'Update rating' : 'Submit rating'}
            </Button>
          </Group>
        </Stack>
      ) : existing ? (
        <Stack gap={6}>
          <Rating value={existing.stars} readOnly />
          {existing.tags.length > 0 && <Text size="sm">{existing.tags.map((t) => tagLabel[t] ?? t).join(' · ')}</Text>}
          {existing.comment && <Text size="sm" c="dimmed">“{existing.comment}”</Text>}
          {editable && (
            <Group justify="space-between" mt={4}>
              <Text size="xs" c="dimmed">
                You can change it until {formatDate(existing.editableUntilUtc)}.
              </Text>
              <Button size="xs" variant="subtle" onClick={() => setEditing(true)}>
                Edit
              </Button>
            </Group>
          )}
        </Stack>
      ) : existingSummary ? (
        <Rating value={existingSummary.stars} readOnly />
      ) : null}
    </SectionCard>
  );
}
