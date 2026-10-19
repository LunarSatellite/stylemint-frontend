import { useState } from 'react';
import { Alert, Button, Card, Group, Tabs } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError, isMissingEndpoint, messageOf } from '../../../api/client';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../../components/StateBlocks';
import { confirmAction, toastError, toastSuccess } from '../../../lib/notify';
import { ServiceCategory, useServiceCategory } from '../category';
import { RequireServiceCategory, ServiceSettingUp } from '../components';
import { LISTINGS_KEY, listingsApi, ListingKind, ListingStatus, type ListingWrite } from './api';
import { DeparturesPanel } from './DeparturesPanel';
import { cleanListing, emptyListing, ListingForm, listingToWrite } from './ListingForm';
import { kindForCategory, listingPath, ListingStatusBadge } from './ListingsPage';
import { RateCalendar } from './RateCalendar';
import { RoomTypesPanel } from './RoomTypesPanel';
import { REEL_ITEMS_KEY, ReelVisibilityBadge, useReelItems } from '../reelItems';

export default function ListingPage() {
  return (
    <RequireServiceCategory allow={[ServiceCategory.Hotel, ServiceCategory.TravelAgency]}>
      <ListingBody />
    </RequireServiceCategory>
  );
}

const PUBLISH_ERRORS: Record<string, string> = {
  'service_listing.not_ready': 'Add at least one room type before publishing.',
  'service_listing.has_upcoming_bookings': 'This listing still has upcoming bookings. Archive it after they are finished or cancelled.',
};

function ListingBody() {
  const { id } = useParams();
  const { category } = useServiceCategory();
  const kind = kindForCategory(category);
  if (!id) return <NewListing kind={kind} />;
  return <ExistingListing id={id} />;
}

function NewListing({ kind }: { kind: number }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const stay = kind === ListingKind.Stay;
  const create = useMutation({
    mutationFn: (w: ListingWrite) => listingsApi.create(cleanListing(w, kind, true)),
    onSuccess: (l) => {
      void qc.invalidateQueries({ queryKey: LISTINGS_KEY });
      toastSuccess(stay ? 'Property saved as a draft. Now add its room types.' : 'Package saved as a draft. Now add departure dates.');
      navigate(`${listingPath(l.listingId)}?tab=${stay ? 'rooms' : 'departures'}`, { replace: true });
    },
    onError: (e) => setError(isMissingEndpoint(e) ? 'Hotel and travel listings are being set up — try again soon.' : messageOf(e)),
  });
  return (
    <>
      <PageHeader title={stay ? 'Add property' : 'Add package'} back={{ to: '/services/listings', label: stay ? 'Properties' : 'Packages' }} />
      <ListingForm kind={kind} initial={emptyListing(kind)} saving={create.isPending} serverError={error} submitLabel="Save as draft" onSubmit={(w) => create.mutate(w)} />
    </>
  );
}

function ExistingListing({ id }: { id: string }) {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const key = [...LISTINGS_KEY, 'detail', id];
  const q = useQuery({ queryKey: key, queryFn: () => listingsApi.get(id) });
  const [saveError, setSaveError] = useState<string | null>(null);
  const reel = useReelItems();
  const l = q.data;

  const save = useMutation({
    mutationFn: (w: ListingWrite) => listingsApi.update(id, cleanListing(w, l!.kind, false)),
    onSuccess: (updated) => {
      qc.setQueryData(key, updated);
      void qc.invalidateQueries({ queryKey: [...LISTINGS_KEY, 'list'] });
      setSaveError(null);
      toastSuccess('Saved.');
    },
    onError: (e) => setSaveError(messageOf(e)),
  });
  const transition = useMutation({
    mutationFn: (action: 'publish' | 'pause' | 'archive') => listingsApi[action](id),
    onSuccess: (updated, action) => {
      qc.setQueryData(key, updated);
      void qc.invalidateQueries({ queryKey: [...LISTINGS_KEY, 'list'] });
      void qc.invalidateQueries({ queryKey: REEL_ITEMS_KEY });
      toastSuccess(action === 'publish' ? 'Published — you and creators can now tag it in reels.' : action === 'pause' ? 'Paused — hidden from reels. Existing bookings are unaffected.' : 'Archived.');
    },
    onError: (e) => toastError(e instanceof ApiError && e.code && PUBLISH_ERRORS[e.code] ? new Error(PUBLISH_ERRORS[e.code]) : e),
  });

  if (q.isPending) return <ListSkeleton rows={4} height={90} />;
  if (q.error) {
    if (isMissingEndpoint(q.error)) return <ServiceSettingUp what="Hotel and travel listings" />;
    if (q.error instanceof ApiError && q.error.status === 404)
      return (
        <Card>
          <EmptyBlock title="Listing not found" body="It may belong to another vendor, or the link is wrong." />
        </Card>
      );
    return <ErrorBlock error={q.error} title="Could not load this listing" onRetry={() => void q.refetch()} />;
  }
  if (!l) return null;

  const stay = l.kind === ListingKind.Stay;
  const tabs = stay ? ['details', 'rooms', 'rates'] : ['details', 'departures'];
  const tab = tabs.includes(params.get('tab') ?? '') ? params.get('tab')! : 'details';
  const archived = l.status === ListingStatus.Archived;
  const ask = async (action: 'publish' | 'pause' | 'archive') => {
    const text = {
      publish: { title: `Publish ${l.title}?`, body: 'It becomes an item you and creators can tag in reels; buyers book it from the item page.', confirmLabel: 'Publish' },
      pause: { title: `Pause ${l.title}?`, body: 'Its reel tags stop opening the item until you publish again. Bookings already made stay as they are.', confirmLabel: 'Pause' },
      archive: { title: `Archive ${l.title}?`, body: 'Archived listings cannot be edited or published again.', confirmLabel: 'Archive', danger: true },
    }[action];
    if (await confirmAction(text)) transition.mutate(action);
  };

  return (
    <>
      <PageHeader
        title={l.title}
        back={{ to: '/services/listings', label: stay ? 'Properties' : 'Packages' }}
        meta={
          <Group gap="xs">
            <ListingStatusBadge status={l.status} />
            <ReelVisibilityBadge visibility={reel.visibility(l.listingId, l.status === ListingStatus.Published)} />
          </Group>
        }
        actions={
          !archived && (
            <Group gap="xs">
              {(l.status === ListingStatus.Draft || l.status === ListingStatus.Paused) && (
                <Button onClick={() => void ask('publish')} loading={transition.isPending && transition.variables === 'publish'}>
                  Publish
                </Button>
              )}
              {l.status === ListingStatus.Published && (
                <Button variant="default" onClick={() => void ask('pause')} loading={transition.isPending && transition.variables === 'pause'}>
                  Pause
                </Button>
              )}
              <Button variant="subtle" color="signal" onClick={() => void ask('archive')}>
                Archive
              </Button>
            </Group>
          )
        }
      />
      {archived && (
        <Alert color="gray" variant="light" mb="md">
          This listing is archived. It is kept for your records and cannot be changed.
        </Alert>
      )}
      <Tabs value={tab} onChange={(v) => setParams(v && v !== 'details' ? { tab: v } : {}, { replace: true })} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="details">{stay ? 'Property' : 'Package'}</Tabs.Tab>
          {stay && <Tabs.Tab value="rooms">Room types</Tabs.Tab>}
          {stay && <Tabs.Tab value="rates">Rates & availability</Tabs.Tab>}
          {!stay && <Tabs.Tab value="departures">Departures</Tabs.Tab>}
        </Tabs.List>
        <Tabs.Panel value="details">
          <ListingForm key={l.updatedUtc} kind={l.kind} initial={listingToWrite(l)} saving={save.isPending} serverError={saveError} submitLabel="Save changes" onSubmit={(w) => (archived ? undefined : save.mutate(w))} />
        </Tabs.Panel>
        {stay && (
          <Tabs.Panel value="rooms">
            <RoomTypesPanel listing={l} readOnly={archived} />
          </Tabs.Panel>
        )}
        {stay && (
          <Tabs.Panel value="rates">
            <RateCalendar listing={l} readOnly={archived} />
          </Tabs.Panel>
        )}
        {!stay && (
          <Tabs.Panel value="departures">
            <DeparturesPanel listing={l} readOnly={archived} />
          </Tabs.Panel>
        )}
      </Tabs>
    </>
  );
}

