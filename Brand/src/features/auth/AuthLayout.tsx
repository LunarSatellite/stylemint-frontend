import type { ReactNode } from 'react';
import { Anchor, Box, Card, Group, Stack, Text, Title } from '@mantine/core';
import { BrandMark } from '../../components/BrandMark';
import { useDocumentTitle } from '../../components/PageHeader';
import { surfaces } from '../../theme';

function Point({ title, body }: { title: string; body: string }) {
  return (
    <Group gap={13} wrap="nowrap" align="flex-start">
      <Box
        mt={7}
        w={6}
        h={6}
        style={{ flexShrink: 0, borderRadius: 3, background: 'linear-gradient(180deg, #6fc2a0, #159a6a)' }}
      />
      <div>
        <Text fw={600} size="sm" lh={1.4}>
          {title}
        </Text>
        <Text size="sm" c={surfaces.textMuted} lh={1.5}>
          {body}
        </Text>
      </div>
    </Group>
  );
}

/** Voyager CX's sign-in layout: product pitch on the left, white card on the right, footer links. */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  useDocumentTitle(title);
  return (
    <Box style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <Box
        component="main"
        style={{
          display: 'grid',
          gap: 'clamp(28px, 6vw, 72px)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          alignItems: 'center',
          width: '100%',
          maxWidth: 1000,
          padding: 'clamp(16px, 5vw, 56px)',
        }}
      >
        <Stack gap="xl" visibleFrom="sm">
          <Group gap="md" wrap="nowrap">
            <BrandMark size={48} />
            <div>
              <Title order={1} lh={1.1} style={{ letterSpacing: '-0.02em' }}>
                StyleMint Seller Center
              </Title>
              <Text size="sm" c={surfaces.textMuted} mt={2}>
                Run your shop on StyleMint — from any phone or computer.
              </Text>
            </div>
          </Group>
          <Stack gap="md">
            <Point title="Orders in one place" body="Accept, pack and hand over parcels, and pick a StyleMint rider in a few taps." />
            <Point title="Products that sell" body="List products with photos, sizes and colours, keep stock right, and offer EMI on bigger buys." />
            <Point title="Know what you earn" body="See today's sales, your balance and every payout, in rupees." />
          </Stack>
        </Stack>

        <Stack gap="md" style={{ width: '100%', maxWidth: 420, justifySelf: 'center' }}>
          <Group gap="sm" hiddenFrom="sm" wrap="nowrap">
            <BrandMark size={40} />
            <div>
              <Title order={2} lh={1.1}>
                StyleMint Seller Center
              </Title>
              <Text size="sm" c={surfaces.textMuted}>
                Run your shop on StyleMint
              </Text>
            </div>
          </Group>

          <Card
            padding="xl"
            style={{
              boxShadow: 'var(--sm-shadow-high)',
              backgroundImage: 'linear-gradient(160deg, rgba(69, 174, 134, 0.055), transparent 46%)',
            }}
          >
            {children}
          </Card>

          <Group justify="center" gap="md">
            <Anchor href="mailto:help@stylemint.app" size="xs" c="dimmed">
              Help
            </Anchor>
            <Anchor href="mailto:privacy@stylemint.com" size="xs" c="dimmed">
              Privacy
            </Anchor>
            <Anchor href="mailto:legal@stylemint.com" size="xs" c="dimmed">
              Terms
            </Anchor>
            <Text size="xs" c="dimmed">
              © StyleMint
            </Text>
          </Group>
        </Stack>
      </Box>
    </Box>
  );
}
