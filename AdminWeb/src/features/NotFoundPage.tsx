import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { IconMapOff } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '@/components/PageHeader';

export function NotFoundPage() {
  useDocumentTitle('Not found');
  return (
    <Center mih="50vh">
      <Stack align="center" gap="sm" ta="center" maw={420}>
        <IconMapOff size={36} opacity={0.6} aria-hidden />
        <Title order={1} fz="h2">
          There’s no page here
        </Title>
        <Text size="sm" c="dimmed">
          The address may be mistyped, or the page moved.
        </Text>
        <Button component={Link} to="/" variant="light">
          Back to the dashboard
        </Button>
      </Stack>
    </Center>
  );
}
