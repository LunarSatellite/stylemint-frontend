import { useState } from 'react';
import { Button, Group, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { RiderQueue } from './RiderQueue';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Riders (delivery partners): every state, with the actions their tier, KYC and escrow need. */
export function RidersPage() {
  const [, setParams] = useSearchParams();
  const [lookup, setLookup] = useState('');
  const valid = GUID.test(lookup.trim());
  return (
    <>
      <PageHeader
        title="Riders"
        description="Delivery partners by state. Open one for identity documents, reliability, escrow and tier actions."
        actions={
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid) return;
              setParams((p) => {
                const n = new URLSearchParams(p);
                n.set('open', lookup.trim().toLowerCase());
                return n;
              });
            }}
          >
            <Group gap="xs" wrap="nowrap">
              <TextInput
                size="sm"
                w={300}
                aria-label="Open a rider by ID"
                placeholder="Open by rider ID"
                leftSection={<IconSearch size={14} />}
                value={lookup}
                onChange={(e) => setLookup(e.currentTarget.value)}
                error={lookup && !valid ? 'Paste a rider ID (GUID)' : undefined}
              />
              <Button type="submit" size="sm" variant="default" disabled={!valid}>
                Open
              </Button>
            </Group>
          </form>
        }
      />
      <RiderQueue />
    </>
  );
}
