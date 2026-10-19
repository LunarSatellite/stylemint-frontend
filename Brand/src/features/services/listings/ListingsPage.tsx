import { Badge, Button, Card, Group, Image, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyBlock } from '../../../components/StateBlocks';
import { formatMoney } from '../../../lib/format';
import { ServiceCategory, useServiceCategory } from '../category';
import { RequireServiceCategory, ServiceQuery } from '../components';
import { ReelVisibilityBadge, useReelItems, type ReelVisibility } from '../reelItems';
import { LISTINGS_KEY, listingsApi, ListingKind, ListingStatus, listingStatusLabel, type Listing } from './api';

export const kindForCategory = (category: number) => (category === ServiceCategory.TravelAgency ? ListingKind.Package : ListingKind.Stay);
export const listingPath = (id: string) => `/services/listings/${encodeURIComponent(id)}`;

export function ListingStatusBadge({ status }: { status: number }) {
  const s = listingStatusLabel[status] ?? { label: 'Unknown', color: 'gray' };
  return (
    <Badge variant="light" color={s.color} size="sm">
      {s.label}
    </Badge>
  );
}

function ListingCard({ l, reel }: { l: Listing; reel: ReelVisibility }) {
  const stay = l.kind === ListingKind.Stay;
  const activeRooms = (l.roomTypes ?? []).filter((r) => r.status === 1).length;
  const from = stay ? l.fromPricePerNight : l.fromPrice;
  return (
    <Card withBorder component={Link} to={listingPath(l.listingId)} data-testid={`listing-${l.listingId}`} padding="sm">
      <Group wrap="nowrap" align="flex-start" gap="sm">
        {l.photoUrls?.[0] ? (
          <Image src={l.photoUrls[0]} alt="" w={88} h={66} radius="md" fit="cover" />
        ) : (
          <Card w={88} h={66} radius="md" withBorder p={0} aria-hidden />
        )}
        <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Text fw={650} truncate>
              {l.title}
            </Text>
            <ListingStatusBadge status={l.status} />
          </Group>
          <Text size="sm" c="dimmed" truncate>
            {stay ? [l.area, l.city].filter(Boolean).join(', ') : `${l.destination ?? l.city} · ${l.durationDays ?? '?'} days`}
          </Text>
          <Text size="xs" c="dimmed">
            {stay ? `${activeRooms} room ${activeRooms === 1 ? 'type' : 'types'}` : `${l.upcomingDepartures ?? 0} upcoming departures`}
            {' · '}
            {l.bookingsUpcoming ?? 0} upcoming bookings
            {from ? ` · from ${formatMoney({ amount: from, currency: l.currency || 'NPR' })}${stay ? ' / night' : ''}` : ''}
          </Text>
          {reel !== 'unknown' && (
            <Group gap={4} mt={2}>
              <ReelVisibilityBadge visibility={reel} />
            </Group>
          )}
        </Stack>
      </Group>
    </Card>
  );
}

/** Hotel properties or travel packages, depending on the vendor's category. */
export default function ListingsPage() {
  return (
    <RequireServiceCategory allow={[ServiceCategory.Hotel, ServiceCategory.TravelAgency]}>
      <ListingsBody />
    </RequireServiceCategory>
  );
}

function ListingsBody() {
  const { category } = useServiceCategory();
  const kind = kindForCategory(category);
  const stay = kind === ListingKind.Stay;
  const query = useQuery({ queryKey: [...LISTINGS_KEY, 'list', kind], queryFn: () => listingsApi.list(kind) });
  const visible = (query.data ?? []).filter((l) => l.status !== 4);
  const reel = useReelItems();
  const archived = (query.data ?? []).length - visible.length;
  return (
    <>
      <PageHeader
        title={stay ? 'Properties' : 'Packages'}
        description={
          stay
            ? 'Your hotel or guest house: property details, room types, nightly rates and availability.'
            : 'Your travel packages: itinerary, departures with seats and prices, and how guests pay.'
        }
        actions={
          <Button leftSection={<IconPlus size={16} />} component={Link} to="/services/listings/new">
            {stay ? 'Add property' : 'Add package'}
          </Button>
        }
      />
      <ServiceQuery
        query={query}
        what={stay ? 'Hotel listings' : 'Travel packages'}
        errorTitle="Could not load your listings"
        isEmpty={() => visible.length === 0}
        empty={
          <Card>
            <EmptyBlock
              title={stay ? 'No property yet' : 'No packages yet'}
              body={stay ? 'Add your property, then its room types and rates, and publish it.' : 'Add a package with its itinerary, then open departure dates.'}
            />
          </Card>
        }
      >
        {() => (
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              {visible.map((l) => (
                <ListingCard key={l.listingId} l={l} reel={reel.visibility(l.listingId, l.status === ListingStatus.Published)} />
              ))}
            </SimpleGrid>
            {archived > 0 && (
              <Text size="xs" c="dimmed">
                {archived} archived {archived === 1 ? 'listing is' : 'listings are'} hidden.
              </Text>
            )}
          </Stack>
        )}
      </ServiceQuery>
    </>
  );
}
