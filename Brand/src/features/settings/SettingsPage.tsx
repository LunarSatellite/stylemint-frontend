import { Button, Card, Group, Stack, Tabs, Text } from '@mantine/core';
import { IconShieldLock } from '@tabler/icons-react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { EmiSettingsSection } from './EmiSettingsSection';
import { ProfileSection } from './ProfileSection';
import { StoresSection } from './StoresSection';
import { TeamSection } from './TeamSection';

export default function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'profile';
  return (
    <>
      <PageHeader title="Store settings" description="Your shop’s profile, stores, team and payment options." />
      <Tabs value={tab} onChange={(v) => setParams(v && v !== 'profile' ? { tab: v } : {}, { replace: true })} keepMounted={false} variant="pills">
        <Tabs.List mb="md">
          <Tabs.Tab value="profile">Profile</Tabs.Tab>
          <Tabs.Tab value="stores">Stores</Tabs.Tab>
          <Tabs.Tab value="team">Team</Tabs.Tab>
          <Tabs.Tab value="emi">EMI</Tabs.Tab>
          <Tabs.Tab value="security">Security</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="profile">
          <ProfileSection />
        </Tabs.Panel>
        <Tabs.Panel value="stores">
          <StoresSection />
        </Tabs.Panel>
        <Tabs.Panel value="team">
          <TeamSection />
        </Tabs.Panel>
        <Tabs.Panel value="emi">
          <Stack>
            <EmiSettingsSection />
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="security">
          <Card>
            <Group justify="space-between" wrap="wrap">
              <div>
                <Text fw={650}>Password and sessions</Text>
                <Text size="sm" c="dimmed">
                  Change your password and see where you are signed in.
                </Text>
              </div>
              <Button component={Link} to="/settings/security" leftSection={<IconShieldLock size={16} />}>
                Open security
              </Button>
            </Group>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
