import { useState } from 'react';
import { Alert, Badge, Button, Group, Stack, Text, Timeline, Title } from '@mantine/core';
import { IconCircleCheck, IconClock, IconFileText, IconRefresh, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../../api/client';
import { recheckRoles, signOut } from '../../auth/session';
import { PROVIDER_NAME } from '../../auth/social';
import { useSession } from '../../auth/useSession';
import { LoadingBlock, ErrorBlock } from '../../components/StateBlocks';
import { formatDate, formatDateTime } from '../../lib/format';
import { surfaces } from '../../theme';
import { AuthLayout } from './AuthLayout';

/** Onboarding's VendorApplicationDto (subset). `state` is an integer. */
export interface VendorApplication {
  id: string;
  state: number;
  brandName: string;
  legalBusinessName: string;
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

async function fetchApplication(): Promise<VendorApplication | null> {
  try {
    return await api.get<VendorApplication>('/v1/vendor/application');
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/**
 * Shown to a signed-in account without the Vendor role: the vendor application's status when there
 * is one, otherwise "this isn't a seller account".
 */
export function ApplicationStatusPage() {
  const app = useQuery({ queryKey: ['vendor-application'], queryFn: fetchApplication });
  const { signInMethod, newAccount } = useSession();
  const viaProvider = signInMethod === 'google' || signInMethod === 'apple' || signInMethod === 'facebook' ? PROVIDER_NAME[signInMethod] : null;
  const [checking, setChecking] = useState(false);
  const [stillPending, setStillPending] = useState(false);

  const recheck = async () => {
    setChecking(true);
    setStillPending(false);
    const status = await recheckRoles();
    setChecking(false);
    if (status === 'notVendor') {
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
    <AuthLayout title="Seller application">
      {app.isPending ? (
        <LoadingBlock label="Checking your seller account…" />
      ) : app.error ? (
        <Stack gap="md">
          <ErrorBlock error={app.error} onRetry={() => void app.refetch()} title="Could not check your seller application" />
          {signOutButton}
        </Stack>
      ) : !app.data ? (
        <Stack gap="md" data-testid="not-a-seller">
          <Title order={3}>This account isn’t a seller account</Title>
          {viaProvider ? (
            <>
              <Text size="sm" c={surfaces.textMuted} data-testid="not-a-seller-provider">
                {newAccount
                  ? `No StyleMint seller account uses the email on this ${viaProvider} account, so this signed you in to a new, empty StyleMint account instead.`
                  : `The StyleMint account linked to this ${viaProvider} account has no shop.`}
              </Text>
              <Alert color="amber" variant="light">
                Sign out, then sign in with the phone number or email your shop was registered with (password or a code).
                To use {viaProvider} next time, the {viaProvider} account must use the same email as your shop.
              </Alert>
            </>
          ) : (
            <Text size="sm" c={surfaces.textMuted}>
              You signed in, but this StyleMint account has not applied to sell. Apply in the StyleMint app (Profile →
              Become a seller). Once your application is approved, come back here and sign in again.
            </Text>
          )}
          {signOutButton}
        </Stack>
      ) : (
        <Stack gap="md" data-testid="application-status">
          <div>
            <Group gap="xs" justify="space-between" wrap="wrap">
              <Title order={3}>Your seller application</Title>
              <Badge color={stateText[app.data.state]?.color ?? 'gray'} variant="light" size="lg">
                {stateText[app.data.state]?.label ?? 'Unknown'}
              </Badge>
            </Group>
            <Text size="sm" c={surfaces.textMuted} mt={4}>
              {app.data.brandName || app.data.legalBusinessName}
            </Text>
          </div>

          {app.data.state === ApplicationState.Rejected && (
            <Alert color="signal" variant="light" icon={<IconX size={16} />} title="Your application was not approved">
              {app.data.rejectionReason || 'StyleMint did not give a reason.'} You can update it and apply again in the
              StyleMint app.
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
              {app.data.expectedDecisionByUtc ? ` Expect a decision by ${formatDate(app.data.expectedDecisionByUtc)}.` : ''} You
              will be notified in the StyleMint app.
            </Alert>
          )}
          {app.data.state === ApplicationState.Approved && (
            <Alert color="forest" variant="light" icon={<IconCircleCheck size={16} />} title="Approved!">
              Your shop is approved. Open Seller Center to start selling.
            </Alert>
          )}
          {stillPending && (
            <Text size="sm" c="dimmed">
              Your account does not have seller access yet. If you were just approved, try again in a minute.
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

          <Button leftSection={<IconRefresh size={16} />} loading={checking} onClick={() => void recheck()} fullWidth>
            {app.data.state === ApplicationState.Approved ? 'Open Seller Center' : 'Check again'}
          </Button>
          {signOutButton}
        </Stack>
      )}
    </AuthLayout>
  );
}
