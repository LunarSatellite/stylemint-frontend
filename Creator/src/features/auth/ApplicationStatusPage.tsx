import { useState } from 'react';
import { Alert, Badge, Button, Group, Stack, Text, Timeline, Title } from '@mantine/core';
import { IconCircleCheck, IconClock, IconFileText, IconRefresh, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError, messageOf } from '../../api/client';
import { recheckRoles, signOut } from '../../auth/session';
import { PROVIDER_NAME } from '../../auth/social';
import { useSession } from '../../auth/useSession';
import { ErrorBlock, LoadingBlock } from '../../components/StateBlocks';
import { formatDate, formatDateTime } from '../../lib/format';
import { surfaces } from '../../theme';
import { AuthLayout } from './AuthLayout';

/** Onboarding's CreatorApplicationDto (subset). `state` is an integer. */
export interface CreatorApplication {
  id: string;
  state: number;
  submittedAtUtc: string | null;
  expectedDecisionByUtc: string | null;
  decisionAtUtc: string | null;
  rejectionReason: string | null;
  createdUtc: string;
}

export const ApplicationState = { Draft: 1, Submitted: 2, UnderReview: 3, Approved: 4, Rejected: 5 } as const;

const stateText: Record<number, { label: string; color: string }> = {
  1: { label: 'Not submitted yet', color: 'gray' },
  2: { label: 'Submitted', color: 'blue' },
  3: { label: 'Under review', color: 'amber' },
  4: { label: 'Approved', color: 'forest' },
  5: { label: 'Not approved', color: 'signal' },
};

async function fetchApplication(): Promise<CreatorApplication | null> {
  try {
    return await api.get<CreatorApplication>('/v1/creator/application');
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/**
 * Shown to a signed-in account without the Creator role: the creator application's status when there is one,
 * otherwise "apply in the StyleMint app".
 *
 * An approved application does not by itself switch the Creator role on (the admin approval only approves the
 * profile). "Open Creator Studio" therefore calls `POST /v1/creator/activate` — idempotent, it switches the
 * role on for an approved creator — and then refreshes the session to pick the role up.
 */
export function ApplicationStatusPage() {
  const app = useQuery({ queryKey: ['creator-application'], queryFn: fetchApplication });
  const { signInMethod, newAccount } = useSession();
  const viaProvider = signInMethod === 'google' || signInMethod === 'apple' || signInMethod === 'facebook' ? PROVIDER_NAME[signInMethod] : null;
  const [checking, setChecking] = useState(false);
  const [stillPending, setStillPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recheck = async (activate: boolean) => {
    setChecking(true);
    setStillPending(false);
    setError(null);
    try {
      if (activate) await api.post('/v1/creator/activate', {});
    } catch (e) {
      setError(messageOf(e));
      setChecking(false);
      return;
    }
    const status = await recheckRoles();
    setChecking(false);
    if (status === 'notCreator') {
      setStillPending(true);
      void app.refetch();
    }
  };

  const signOutButton = (
    <Button variant="default" fullWidth onClick={() => void signOut()}>
      Sign out
    </Button>
  );

  return (
    <AuthLayout title="Creator application">
      {app.isPending ? (
        <LoadingBlock label="Checking your creator account…" />
      ) : app.error ? (
        <Stack gap="md">
          <ErrorBlock error={app.error} onRetry={() => void app.refetch()} title="Could not check your creator application" />
          {signOutButton}
        </Stack>
      ) : !app.data ? (
        <Stack gap="md" data-testid="not-a-creator">
          <Title order={3}>This account isn’t a creator account yet</Title>
          {viaProvider ? (
            <>
              <Text size="sm" c={surfaces.textMuted} data-testid="not-a-creator-provider">
                {newAccount
                  ? `No StyleMint account uses the email on this ${viaProvider} account, so this signed you in to a new, empty StyleMint account.`
                  : `The StyleMint account linked to this ${viaProvider} account is not a creator account.`}
              </Text>
              <Alert color="amber" variant="light">
                If you are already a creator, sign out and sign in with the phone number or email of your creator account (password or a
                code). Otherwise, apply in the StyleMint app.
              </Alert>
            </>
          ) : (
            <Text size="sm" c={surfaces.textMuted}>
              Apply to become a creator in the StyleMint app (Profile → Become a creator). Once you are a creator, come back here and
              sign in again.
            </Text>
          )}
          {signOutButton}
        </Stack>
      ) : (
        <Stack gap="md" data-testid="application-status">
          <div>
            <Group gap="xs" justify="space-between" wrap="wrap">
              <Title order={3}>Your creator application</Title>
              <Badge color={stateText[app.data.state]?.color ?? 'gray'} variant="light" size="lg">
                {stateText[app.data.state]?.label ?? 'Unknown'}
              </Badge>
            </Group>
          </div>

          {error && (
            <Alert color="signal" variant="light" role="alert">
              {error}
            </Alert>
          )}
          {app.data.state === ApplicationState.Rejected && (
            <Alert color="signal" variant="light" icon={<IconX size={16} />} title="Your application was not approved">
              {app.data.rejectionReason || 'StyleMint did not give a reason.'} You can update it and apply again in the StyleMint app.
            </Alert>
          )}
          {app.data.state === ApplicationState.Draft && (
            <Alert color="gray" variant="light" icon={<IconFileText size={16} />}>
              Your application is saved but not submitted. Finish it in the StyleMint app.
            </Alert>
          )}
          {(app.data.state === ApplicationState.Submitted || app.data.state === ApplicationState.UnderReview) && (
            <Alert color="amber" variant="light" icon={<IconClock size={16} />}>
              We are reviewing your application.
              {app.data.expectedDecisionByUtc ? ` Expect a decision by ${formatDate(app.data.expectedDecisionByUtc)}.` : ''} You will be
              notified in the StyleMint app.
            </Alert>
          )}
          {app.data.state === ApplicationState.Approved && (
            <Alert color="forest" variant="light" icon={<IconCircleCheck size={16} />} title="Approved!">
              You are a StyleMint creator. Open Creator Studio to get started.
            </Alert>
          )}
          {stillPending && (
            <Text size="sm" c="dimmed">
              Your account does not have creator access yet. If you were just approved, try again in a minute.
            </Text>
          )}

          <Timeline active={app.data.state >= 4 ? 2 : app.data.state >= 2 ? 1 : 0} bulletSize={20} lineWidth={2} color="forest">
            <Timeline.Item title="Application started">
              <Text size="xs" c="dimmed">
                {formatDateTime(app.data.createdUtc)}
              </Text>
            </Timeline.Item>
            <Timeline.Item title="Submitted">
              <Text size="xs" c="dimmed">
                {formatDateTime(app.data.submittedAtUtc)}
              </Text>
            </Timeline.Item>
            <Timeline.Item title="Decision">
              <Text size="xs" c="dimmed">
                {app.data.decisionAtUtc ? formatDateTime(app.data.decisionAtUtc) : 'Waiting'}
              </Text>
            </Timeline.Item>
          </Timeline>

          <Button
            leftSection={<IconRefresh size={16} />}
            loading={checking}
            onClick={() => void recheck(app.data!.state === ApplicationState.Approved)}
            fullWidth
          >
            {app.data.state === ApplicationState.Approved ? 'Open Creator Studio' : 'Check again'}
          </Button>
          {signOutButton}
        </Stack>
      )}
    </AuthLayout>
  );
}
