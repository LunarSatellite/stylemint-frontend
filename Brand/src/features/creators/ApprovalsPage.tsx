import { useState } from 'react';
import { Anchor, AspectRatio, Badge, Button, Card, Group, Image, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconCheck, IconExternalLink, IconMovie, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { compactCount } from './labels';
import { fromNow } from '../../lib/format';
import { toastError, toastSuccess } from '../../lib/notify';
import { creatorsApi, type ReelApproval } from './api';
import { confirmAction, CreatorLine, CREATORS_KEY, ReasonModal } from './components';

/** The reel itself, when it is public already. Pending reels are usually not — then a placeholder. */
function ReelPreview({ reelId }: { reelId: string }) {
  const reel = useQuery({ queryKey: [CREATORS_KEY, 'reel', reelId], queryFn: () => creatorsApi.reel(reelId), retry: false, staleTime: 5 * 60_000 });
  return (
    <Stack gap={6}>
      <AspectRatio ratio={9 / 16} maw={180} style={{ borderRadius: 10, overflow: 'hidden', background: 'var(--sm-inset)' }}>
        {reel.data?.thumbnailCdnUrl ? (
          <Image src={reel.data.thumbnailCdnUrl} alt={reel.data.caption ?? 'Reel'} fit="cover" />
        ) : (
          <Stack align="center" justify="center" gap={4}>
            <IconMovie size={28} opacity={0.5} aria-hidden />
            <Text size="xs" c="dimmed">
              Preview in the app
            </Text>
          </Stack>
        )}
      </AspectRatio>
      {reel.data?.caption && (
        <Text size="xs" lineClamp={3}>
          {reel.data.caption}
        </Text>
      )}
      {reel.data && (
        <Group gap={6}>
          <Text size="xs" c="dimmed">
            {compactCount(reel.data.viewCount)} views · {compactCount(reel.data.likeCount)} likes
          </Text>
          {reel.data.sourceUrl && (
            <Anchor href={reel.data.sourceUrl} target="_blank" rel="noreferrer" size="xs">
              Open <IconExternalLink size={12} />
            </Anchor>
          )}
        </Group>
      )}
    </Stack>
  );
}

function ApprovalCard({ a }: { a: ReelApproval }) {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const approve = useMutation({
    mutationFn: () => creatorsApi.approveReel(a.id),
    onSuccess: () => {
      toastSuccess('Reel approved. It can go live now.');
      void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'reel-approvals'] });
    },
    onError: (e) => toastError(e, 'Could not approve'),
  });
  return (
    <Card withBorder padding="md" data-testid="approval-card">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <CreatorLine accountId={a.creatorAccountId} extra={`sent ${fromNow(a.submittedUtc)}`} />
          {a.round > 1 && (
            <Badge variant="light" color="amber" size="sm">
              Round {a.round}
            </Badge>
          )}
        </Group>
        <ReelPreview reelId={a.reelId} />
        {a.creatorNote && (
          <Text size="sm">
            <Text span c="dimmed" size="xs">
              Note:{' '}
            </Text>
            {a.creatorNote}
          </Text>
        )}
        <Group gap="xs" grow>
          <Button
            leftSection={<IconCheck size={16} />}
            loading={approve.isPending}
            onClick={async () => {
              const ok = await confirmAction({
                title: 'Approve this reel?',
                body: 'The creator can publish it with your products tagged. Approval cannot be taken back.',
                confirmLabel: 'Approve',
              });
              if (ok) approve.mutate();
            }}
          >
            Approve
          </Button>
          <Button variant="default" color="signal" leftSection={<IconX size={16} />} onClick={() => setRejecting(true)} disabled={approve.isPending}>
            Ask for changes
          </Button>
        </Group>
      </Stack>
      <ReasonModal
        opened={rejecting}
        onClose={() => setRejecting(false)}
        title="Ask for changes"
        intro="The reel will not go live. Tell the creator what to change — they can send a new version."
        label="What should change?"
        confirmLabel="Send to creator"
        danger
        maxLength={500}
        onConfirm={async (reason) => {
          await creatorsApi.rejectReel(a.id, reason);
          toastSuccess('Sent back to the creator');
          void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'reel-approvals'] });
        }}
      />
    </Card>
  );
}

export default function ApprovalsPage() {
  const q = useQuery({ queryKey: [CREATORS_KEY, 'reel-approvals'], queryFn: creatorsApi.reelApprovals, refetchInterval: 60_000 });
  const pending = (q.data ?? []).filter((a) => a.state === 1);
  return (
    <>
      <PageHeader
        title="Content approvals"
        description="Reels that tag your products under a brief that needs your approval. Approve, or ask the creator for changes."
      />
      {q.isPending ? (
        <ListSkeleton rows={3} height={140} />
      ) : q.error ? (
        <ErrorBlock error={q.error} title="Could not load reels waiting for approval" onRetry={() => void q.refetch()} />
      ) : pending.length === 0 ? (
        <EmptyBlock
          title="Nothing waiting for approval"
          body={
            <>
              Reels appear here when an agreement or brief says you approve content first. See how reels sell in{' '}
              <Anchor component={Link} to="/insights/reels">
                Insights
              </Anchor>
              .
            </>
          }
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {pending.map((a) => (
            <ApprovalCard key={a.id} a={a} />
          ))}
        </SimpleGrid>
      )}
    </>
  );
}
