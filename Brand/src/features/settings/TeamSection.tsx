import { useState } from 'react';
import { ActionIcon, Alert, Badge, Button, Card, Group, Menu, Modal, Select, Stack, Text, TextInput } from '@mantine/core';
import { IconDots, IconPlus, IconTrash, IconUserCog } from '@tabler/icons-react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { messageOf } from '../../api/client';
import { authApi } from '../../auth/api';
import { useSession } from '../../auth/useSession';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDate } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import { settingsApi, TeamRole, teamRoleLabel } from './api';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function AddMemberModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { accountId } = useSession();
  const qc = useQueryClient();
  const [memberId, setMemberId] = useState('');
  const [role, setRole] = useState<string | null>(String(TeamRole.Member));
  const [error, setError] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () => settingsApi.addMember(accountId!, memberId.trim(), Number(role)),
    onSuccess: () => {
      toastSuccess('Invitation sent. They accept it in the StyleMint app.');
      void qc.invalidateQueries({ queryKey: ['team'] });
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });
  return (
    <Modal opened={opened} onClose={onClose} title="Add a team member">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Ask the person for their StyleMint account ID. Inviting by email or phone is not available yet.
        </Text>
        {error && (
          <Alert color="signal" variant="light">
            {error}
          </Alert>
        )}
        <TextInput label="Account ID" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={memberId} onChange={(e) => setMemberId(e.currentTarget.value)} />
        <Select
          label="Role"
          data={[
            { value: String(TeamRole.Admin), label: 'Admin — can manage the team' },
            { value: String(TeamRole.Member), label: 'Member' },
          ]}
          value={role}
          onChange={setRole}
          allowDeselect={false}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={add.isPending}
            onClick={() => (GUID.test(memberId.trim()) ? add.mutate() : setError('That does not look like a StyleMint account ID.'))}
          >
            Invite
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function TeamSection() {
  const { accountId } = useSession();
  const qc = useQueryClient();
  const team = useQuery({ queryKey: ['team', accountId], queryFn: () => settingsApi.team(accountId!), enabled: !!accountId });
  const [adding, setAdding] = useState(false);
  const members = (team.data ?? []).filter((m) => !m.removedUtc);
  // The membership DTO has ids only: resolve names from the accounts endpoint.
  const names = useQueries({
    queries: members.map((m) => ({
      queryKey: ['account', m.memberAccountId],
      queryFn: () => authApi.account(m.memberAccountId),
      staleTime: 10 * 60_000,
      retry: false,
    })),
  });
  const act = useMutation({
    mutationFn: (s: { run: () => Promise<unknown>; done: string }) => s.run().then(() => s.done),
    onSuccess: (done) => {
      toastSuccess(done);
      void qc.invalidateQueries({ queryKey: ['team'] });
    },
    onError: (e) => toastError(e),
  });

  return (
    <SectionCard
      title="Team"
      description="People who help run your shop."
      action={
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setAdding(true)}>
          Add member
        </Button>
      }
    >
      {team.isPending ? (
        <ListSkeleton rows={2} />
      ) : team.error ? (
        <ErrorBlock error={team.error} onRetry={() => void team.refetch()} title="Could not load your team" />
      ) : members.length === 0 ? (
        <EmptyBlock title="Just you for now" body="Add staff so they can help with orders." />
      ) : (
        <Stack gap="xs">
          {members.map((m, i) => (
            <Card key={m.id} padding="sm" withBorder>
              <Group justify="space-between" wrap="nowrap">
                <div style={{ minWidth: 0 }}>
                  <Group gap={6}>
                    <Text fw={600} size="sm" truncate>
                      {names[i]?.data?.displayName ?? 'StyleMint user'}
                    </Text>
                    <Badge size="xs" variant="light">
                      {teamRoleLabel[m.role]}
                    </Badge>
                    {!m.acceptedUtc && (
                      <Badge size="xs" color="amber" variant="light">
                        Invited
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {m.acceptedUtc ? `Joined ${formatDate(m.acceptedUtc)}` : `Invited ${formatDate(m.invitedUtc)}`}
                  </Text>
                </div>
                {m.role !== TeamRole.Owner && (
                  <Menu position="bottom-end">
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" aria-label="Member actions">
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconUserCog size={14} />}
                        onClick={() =>
                          act.mutate({
                            run: () => settingsApi.changeRole(accountId!, m.id, m.role === TeamRole.Admin ? TeamRole.Member : TeamRole.Admin),
                            done: 'Role changed',
                          })
                        }
                      >
                        Make {m.role === TeamRole.Admin ? 'member' : 'admin'}
                      </Menu.Item>
                      <Menu.Item
                        color="signal"
                        leftSection={<IconTrash size={14} />}
                        onClick={() =>
                          void confirmAction({ title: 'Remove from team?', body: 'They lose access to your shop.', confirmLabel: 'Remove', danger: true }).then(
                            (ok) => ok && act.mutate({ run: () => settingsApi.removeMember(accountId!, m.id, null), done: 'Member removed' }),
                          )
                        }
                      >
                        Remove
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                )}
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      {adding && <AddMemberModal opened onClose={() => setAdding(false)} />}
    </SectionCard>
  );
}
