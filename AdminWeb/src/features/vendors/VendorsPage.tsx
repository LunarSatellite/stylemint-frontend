import { useEffect } from 'react';
import { Alert, Anchor, Badge, Button, Group, Select, Skeleton, Stack, Text, TextInput } from '@mantine/core';
import { keepPreviousData, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { Page } from '@/api/paging';
import { IconBuildingStore, IconDiscountCheck, IconReceipt, IconSearch } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { ApiError } from '@/api/errors';
import {
  APPLICATION_STATE,
  applicationsApi,
  BUSINESS_TYPE,
  CATALOG_SIZE,
  isMissing,
  vendorsApi,
  verificationApi,
  type VendorApplication,
  type VendorRow,
} from '@/api/people';
import { useAuth } from '@/auth/guards';
import { useActionDialog } from '@/components/ActionDialog';
import { FieldGrid, IdText, StatusBadge, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { PageHeader } from '@/components/PageHeader';
import { ErrorBlock, NotAvailableBlock, SectionCard } from '@/components/StateBlocks';
import { useCursorPages } from '@/hooks/useCursorPages';
import { useListState } from '@/hooks/useListState';
import { fmtMoney, fmtPercent, mask } from '@/lib/format';

/**
 * The vendor directory. It reads `GET /v1/admin/vendors` (being added by the backend); until that exists it falls
 * back to vendor applications from onboarding - approved by default - which carry the same shop facts, and says so.
 */
export function VendorsPage() {
  const list = useListState(['verified', 'appState'] as const);
  const directory = useQuery({
    queryKey: ['vendors', 'list', list.search, list.filters.verified, list.page, list.pageSize],
    queryFn: ({ signal }) => vendorsApi.list({ search: list.search, verified: list.filters.verified, page: list.page, pageSize: list.pageSize }, signal),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const fallback = isMissing(directory.error);

  return (
    <>
      <PageHeader title="Vendors" description="Every shop on StyleMint. Open one for its business details, verification badge and orders." />
      {fallback ? <ApplicationsDirectory /> : <Directory list={list} query={directory} />}
    </>
  );
}

function vendorName(v: VendorRow) {
  return v.brandName || v.displayName || v.legalName || v.legalBusinessName || 'Unnamed shop';
}

function Directory({ list, query }: { list: ReturnType<typeof useListState<'verified' | 'appState'>>; query: UseQueryResult<Page<VendorRow>> }) {
  const columns: Column<VendorRow>[] = [
    { key: 'name', header: 'Shop', render: (v) => <TwoLine primary={vendorName(v)} secondary={v.legalName || v.legalBusinessName} /> },
    {
      key: 'verified',
      header: 'Badge',
      render: (v) =>
        v.isVerified ? (
          <Badge variant="light" color="forest" leftSection={<IconDiscountCheck size={12} />}>
            Verified
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            Not verified
          </Text>
        ),
    },
    { key: 'city', header: 'Location', visibleFrom: 'md', render: (v) => [v.city, v.countryCode].filter(Boolean).join(', ') || '—' },
    { key: 'products', header: 'Products', visibleFrom: 'lg', align: 'right', render: (v) => v.productCount ?? '—' },
    { key: 'status', header: 'Status', visibleFrom: 'sm', render: (v) => <StatusBadge value={v.status ?? null} /> },
    { key: 'since', header: 'Since', visibleFrom: 'md', render: (v) => <When value={v.approvedUtc ?? v.createdUtc ?? null} /> },
  ];
  return (
    <>
      <DataTable
        label="Vendors"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(v) => v.accountId}
        onRowClick={(v) => list.open(v.accountId)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        filtered={list.filtered}
        emptyTitle="No vendors yet"
        toolbar={
          <Group gap="md" align="flex-end" wrap="wrap">
            <TextInput
              label="Search"
              placeholder="Shop, legal name, email or phone"
              leftSection={<IconSearch size={14} />}
              w={300}
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.currentTarget.value)}
            />
            <Select
              label="Badge"
              w={170}
              data={[
                { value: '', label: 'Any' },
                { value: 'true', label: 'Verified' },
                { value: 'false', label: 'Not verified' },
              ]}
              value={list.filters.verified}
              onChange={(v) => list.setFilter('verified', v)}
            />
          </Group>
        }
      />
      <VendorDrawer accountId={list.selected} onClose={() => list.open(null)} row={query.data?.items.find((v) => v.accountId === list.selected)} />
    </>
  );
}

function ApplicationsDirectory() {
  const { can } = useAuth();
  const list = useListState(['appState'] as const, { appState: '4' });
  const state = list.filters.appState || '4';
  const cursors = useCursorPages(state, list.page, list.setPage);
  const query = useQuery({
    queryKey: ['vendors', 'applications', state, cursors.cursor, list.page, list.pageSize],
    queryFn: ({ signal }) => applicationsApi.vendors(state === 'all' ? undefined : state, cursors.cursor, list.pageSize, list.page, signal),
    enabled: can('viewVendorApplications') && cursors.ready,
    placeholderData: keepPreviousData,
  });
  useEffect(() => {
    if (query.data) cursors.remember(list.page, query.data.nextCursor);
  }, [query.data, list.page, cursors]);

  if (!can('viewVendorApplications')) {
    return (
      <NotAvailableBlock
        what="The vendor directory"
        detail="The server doesn’t list vendors yet, and the onboarding applications it falls back to are open to KYC reviewers only. This page fills in once the backend ships the vendor list."
      />
    );
  }

  const needle = list.searchInput.trim().toLowerCase();
  const page =
    query.data && needle
      ? { ...query.data, items: query.data.items.filter((a) => [a.brandName, a.legalBusinessName, a.city, a.accountId].some((v) => v?.toLowerCase().includes(needle))) }
      : query.data;

  const columns: Column<VendorApplication>[] = [
    { key: 'name', header: 'Shop', render: (a) => <TwoLine primary={a.brandName} secondary={a.legalBusinessName} /> },
    { key: 'state', header: 'Application', render: (a) => <StatusBadge value={APPLICATION_STATE[a.state]} /> },
    { key: 'type', header: 'Business', visibleFrom: 'lg', render: (a) => BUSINESS_TYPE[a.businessType] ?? '—' },
    { key: 'city', header: 'Location', visibleFrom: 'md', render: (a) => [a.city, a.countryCode].filter(Boolean).join(', ') || '—' },
    { key: 'decided', header: 'Decided', visibleFrom: 'sm', render: (a) => <When value={a.decisionAtUtc ?? a.submittedAtUtc} /> },
  ];

  return (
    <Stack gap="md">
      <Alert variant="light" color="slate" icon={<IconBuildingStore size={16} />}>
        Showing vendor <b>applications</b> from onboarding while the backend adds the vendor directory. Badges and order counts appear once it ships.
      </Alert>
      <DataTable
        label="Vendor applications"
        columns={columns}
        page={page}
        isLoading={query.isLoading || !cursors.ready}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(a) => a.accountId}
        onRowClick={(a) => list.open(a.accountId)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        pagerMode="cursor"
        filtered={!!needle || state !== '4'}
        emptyTitle="No vendors in this state"
        toolbar={
          <Group gap="md" align="flex-end" wrap="wrap">
            <Select
              label="Application state"
              w={190}
              data={[...Object.entries(APPLICATION_STATE).map(([value, label]) => ({ value, label })), { value: 'all', label: 'All states' }]}
              value={state}
              onChange={(v) => list.setFilter('appState', v === '4' ? null : v)}
              allowDeselect={false}
            />
            <TextInput
              label="Filter this page"
              placeholder="Shop or legal name"
              leftSection={<IconSearch size={14} />}
              w={260}
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.currentTarget.value)}
            />
          </Group>
        }
      />
      <VendorDrawer accountId={list.selected} onClose={() => list.open(null)} application={query.data?.items.find((a) => a.accountId === list.selected)} />
    </Stack>
  );
}

function VendorDrawer({ accountId, onClose, row, application }: { accountId: string | null; onClose: () => void; row?: VendorRow; application?: VendorApplication }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const detail = useQuery({
    queryKey: ['vendors', 'detail', accountId],
    queryFn: ({ signal }) => vendorsApi.detail(accountId!, signal),
    enabled: accountId !== null && !application,
    retry: false,
  });
  const v: VendorRow | undefined = detail.data ?? row;
  const name = application?.brandName ?? (v ? vendorName(v) : 'Vendor');
  const verified = v?.isVerified ?? null;

  const verify = (on: boolean) =>
    open({
      title: on ? `Give ${name} the verified badge` : `Remove ${name}’s verified badge`,
      consequence: on
        ? 'Shoppers see a verified badge on the shop and its products. Only verify a shop whose identity and business documents you have checked.'
        : 'The verified badge disappears from the shop and its products straight away.',
      confirmLabel: on ? 'Verify shop' : 'Remove badge',
      danger: !on,
      run: () => (on ? verificationApi.verifyVendor(accountId!) : verificationApi.unverifyVendor(accountId!)),
      success: (r) => ((r as { isVerified?: boolean })?.isVerified ? 'Shop verified.' : 'Badge removed.'),
      onDone: () => void queryClient.invalidateQueries({ queryKey: ['vendors'] }),
    });

  return (
    <DetailDrawer
      opened={accountId !== null}
      onClose={onClose}
      title={name}
      subtitle={application?.legalBusinessName ?? v?.legalName ?? v?.legalBusinessName ?? undefined}
      badges={
        <>
          {verified === true && (
            <Badge color="forest" variant="light" leftSection={<IconDiscountCheck size={12} />}>
              Verified
            </Badge>
          )}
          {application && <StatusBadge value={APPLICATION_STATE[application.state]} />}
        </>
      }
      actions={
        <>
          {can('verifyVendors') && accountId && (
            <>
              {verified !== true && (
                <Button size="sm" leftSection={<IconDiscountCheck size={16} />} onClick={() => verify(true)}>
                  Verify shop
                </Button>
              )}
              {verified !== false && (
                <Button size="sm" variant="light" color="signal" onClick={() => verify(false)}>
                  Remove badge
                </Button>
              )}
            </>
          )}
          {can('viewOrders') && accountId && (
            <Button size="sm" variant="default" leftSection={<IconReceipt size={16} />} component={Link} to={`/orders?vendor=${encodeURIComponent(accountId)}`}>
              Orders
            </Button>
          )}
        </>
      }
    >
      {dialog}
      {application ? (
        <ApplicationFacts a={application} />
      ) : detail.isLoading && !row ? (
        <Skeleton height={200} radius="lg" />
      ) : detail.error && !(detail.error instanceof ApiError && detail.error.isMissingEndpoint) && !row ? (
        <ErrorBlock error={detail.error} onRetry={() => void detail.refetch()} />
      ) : v ? (
        <SectionCard title="Shop">
          <FieldGrid
            fields={[
              { label: 'Shop name', value: vendorName(v) },
              { label: 'Legal name', value: v.legalName ?? v.legalBusinessName },
              { label: 'Email', value: v.email },
              { label: 'Phone', value: v.phone },
              { label: 'Location', value: [v.city, v.countryCode].filter(Boolean).join(', ') },
              { label: 'Products', value: v.productCount != null ? String(v.productCount) : null },
              { label: 'Orders', value: v.orderCount != null ? String(v.orderCount) : null },
              { label: 'Verified', value: v.verifiedUtc ? <When value={v.verifiedUtc} /> : verified ? 'Yes' : 'No' },
              { label: 'Account', value: <IdText value={v.accountId} /> },
            ]}
          />
        </SectionCard>
      ) : null}
    </DetailDrawer>
  );
}

function ApplicationFacts({ a }: { a: VendorApplication }) {
  return (
    <Stack gap="lg">
      <SectionCard title="Business">
        <FieldGrid
          fields={[
            { label: 'Brand', value: a.brandName },
            { label: 'Legal name', value: a.legalBusinessName },
            { label: 'Business type', value: BUSINESS_TYPE[a.businessType] },
            { label: 'Registration number', value: a.businessRegistrationNumber ? <span className="sm-mono">{mask(a.businessRegistrationNumber)}</span> : null },
            { label: 'Tax ID', value: a.taxId ? <span className="sm-mono">{mask(a.taxId)}</span> : null },
            {
              label: 'Website',
              value: a.website ? (
                <Anchor href={/^https?:\/\//i.test(a.website) ? a.website : `https://${a.website}`} target="_blank" rel="noopener noreferrer nofollow" size="sm">
                  {a.website}
                </Anchor>
              ) : null,
            },
            { label: 'Address', value: [a.addressLine1, a.addressLine2, a.city, a.stateProvince, a.postalCode, a.countryCode].filter(Boolean).join(', '), wide: true },
            { label: 'Catalogue size', value: a.catalogSize ? CATALOG_SIZE[a.catalogSize] : null },
            {
              label: 'Price range',
              value: a.priceRangeMinAmount != null ? `${fmtMoney(a.priceRangeMinAmount, a.priceRangeCurrency)} – ${fmtMoney(a.priceRangeMaxAmount, a.priceRangeCurrency)}` : null,
            },
            { label: 'Commission', value: a.commissionMinPercent || a.commissionMaxPercent ? `${fmtPercent(a.commissionMinPercent, 0)} – ${fmtPercent(a.commissionMaxPercent, 0)}` : null },
            { label: 'Story', value: a.brandStory, wide: true },
          ]}
        />
      </SectionCard>
      <SectionCard title="Payout account">
        {a.bankAccount ? (
          <FieldGrid
            fields={[
              { label: 'Holder', value: a.bankAccount.accountHolderName },
              { label: 'Bank', value: a.bankAccount.bankName },
              { label: 'Account', value: <span className="sm-mono">•••• {a.bankAccount.lastFourAccountDigits}</span> },
            ]}
          />
        ) : (
          <Text size="sm" c="dimmed">
            No bank account on the application.
          </Text>
        )}
      </SectionCard>
      <SectionCard title="Application">
        <FieldGrid
          fields={[
            { label: 'Submitted', value: <When value={a.submittedAtUtc} /> },
            { label: 'Decided', value: <When value={a.decisionAtUtc} /> },
            { label: 'Rejection reason', value: a.rejectionReason, wide: true },
            { label: 'Account', value: <IdText value={a.accountId} /> },
            { label: 'Application', value: <IdText value={a.id} /> },
          ]}
        />
      </SectionCard>
    </Stack>
  );
}
