import { Button, Card, Center, Code, Group, Stack, Text, Title } from '@mantine/core';
import { IconHourglass } from '@tabler/icons-react';
import { signOut, useSession } from '@/auth/session';
import { BrandMark } from '@/components/Chrome';
import { useDocumentTitle } from '@/components/PageHeader';

/**
 * Signed in, but no admin role yet. The server registers a new operator on first sign-in with no roles, and every
 * admin endpoint refuses them until a Super Admin grants one - so instead of a console full of errors, say that.
 */
export function AwaitingAccessPage() {
  useDocumentTitle('Waiting for access');
  const { session } = useSession();
  return (
    <Center mih="100vh" p="md" component="main">
      <Card padding="xl" maw={520} w="100%" style={{ boxShadow: 'var(--sm-shadow-high)' }}>
        <Stack gap="md">
          <Group gap="sm">
            <BrandMark size={36} />
            <Title order={1} fz="h3">
              You’re signed in - access is pending
            </Title>
          </Group>
          <Group gap="sm" wrap="nowrap" align="flex-start">
            <IconHourglass size={22} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
            <Text size="sm">
              Your account has no StyleMint admin role yet, so there is nothing you can open. Ask a Super Admin to grant you a role under <b>Platform → Admins &amp; roles</b>,
              then sign out and in again - roles are read when you sign in.
            </Text>
          </Group>
          {session && (
            <Text size="sm" c="dimmed">
              Your admin account: <Code>{session.claims.email || session.claims.adminAccountId}</Code>
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => void signOut()}>
              Sign out
            </Button>
          </Group>
        </Stack>
      </Card>
    </Center>
  );
}
