import { useEffect } from 'react';
import { Alert, Anchor, Avatar, Badge, Button, Group, Select, SimpleGrid, Skeleton, Stack, Table, Text, TextInput } from '@mantine/core';
import { keepPreviousData, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { IconBuildingStore, IconDiscountCheck, IconPlayerPause, IconPlayerPlay, IconReceipt, IconSearch, IconShirt } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { DECISION_LABEL, REASON_LABEL, type KycReasonCode } from '@/api/kyc';
import type { Page } from '@/api/paging';
import {
  APPLICATION_STATE,
  applicationsApi,
  BUSINESS_TYPE,
  CATALOG_SIZE,
  isMissing,
  VENDOR_SORT,
  VENDOR_STATUS_FILTER,
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
import { MetricTile } from '@/components/MetricTile';
import { PageHeader } from '@/components/PageHeader';
import { ErrorBlock, NotAvailableBlock, SectionCard } from '@/components/StateBlocks';
import { useCursorPages } from '@/hooks/useCursorPages';
import { useListState } from '@/hooks/useListState';
import { fmtMoney, fmtNumber, fmtPercent, humanize, mask } from '@/lib/format';

const nameOf = (v: Pick<VendorRow, 'businessName'>) => v.businessName || 'Unnamed shop';

/**
 * Every shop on StyleMint, from first application to active seller: `GET /v1/admin/vendors`. Until that endpoint is
 * deployed the page falls back to onboarding vendor applications and says so.
 */
export function VendorsPage() {
  const list = useListState(['status', 'sort', 'appState'] as const);
  const directory = useQuery({
    queryKey: ['vendors', 'list', list.search, list.filters.status, list.filters.sort, list.page, list.pageSize],
    queryFn: ({ signal }) => vendorsApi.list({ search: list.search, status: list.filters.status, sort: list.filters.sort, page: list.page, pageSize: list.pageSize }, signal),
    placeholderData: keepPreviousData,
    retry: false,
  });
  return (
    <>
      <PageHeader title="Vendors" description="Every shop - applicants, active sellers, suspended. Open one for its business, KYC, products, orders and payouts." />
      {isMissing(directory.error) ? <ApplicationsDirectory /> : <Directory list={list} query={directory} />}
    </>
  );
}

function Directory({ list, query }: { list: ReturnType<typeof useListState<'status' | 'sort' | 'appState'>>; query: UseQueryResult<Page<VendorRow>> }) {
  const columns: Column<VendorRow>[] = [
    {
      key: 'name',
      header: 'Shop',
      render: (v) => (
        <Group gap="sm" wrap="nowrap">
          <Avatar src={v.logoUrl} radius="md" size={36} alt="">
            {nameOf(v).slice(0, 1)}
          </Avatar>
          <TwoLine
            primary={
              <Group gap={4} wrap="nowrap" component="span">
                {nameOf(v)}
                {v.isVerified && <IconDiscountCheck size={15} color="var(--mantine-color-forest-7)" aria-label="Verified" />}
              </Group>
            }
            secondary={v.contact?.emailMasked ?? v.contact?.phoneMasked}
          />
        </Group>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (v) =>
        v.isSuspended ? (
          <Badge color="signal" variant="light">
            Suspended
          </Badge>
        ) : (
          <StatusBadge value={v.applicationStatus} />
        ),
    },
    { key: 'products', header: 'Products', align: 'right', visibleFrom: 'md', render: (v) => (v.products ? `${fmtNumber(v.products.active)} / ${fmtNumber(v.products.total)}` : '—') },
    { key: 'orders', header: 'Orders 30d', align: 'right', visibleFrom: 'md', render: (v) => fmtNumber(v.orders30d?.count) },
    { key: 'gmv', header: 'Sales 30d', align: 'right', visibleFrom: 'lg', render: (v) => (v.orders30d ? fmtMoney(v.orders30d.gmv.amount, v.orders30d.gmv.currency) : '—') },
    {
      key: 'payouts',
      header: 'Payouts',
      visibleFrom: 'lg',
      render: (v) =>
        v.payoutHold?.isOnHold ? (
          <Badge color="amber" variant="light">
            {v.payoutHold.heldCount} on hold
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
    },
    { key: 'since', header: 'Joined', visibleFrom: 'sm', render: (v) => <When value={v.createdUtc} /> },
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
            <TextInput label="Search" placeholder="Shop name, email or phone" leftSection={<IconSearch size={14} />} w={280} value={list.searchInput} onChange={(e) => list.setSearchInput(e.currentTarget.value)} />
            <Select label="Status" w={200} clearable placeholder="Any" data={VENDOR_STATUS_FILTER} value={list.filters.status || null} onChange={(v) => list.setFilter('status', v)} />
            <Select label="Sort" w={180} data={VENDOR_SORT} value={list.filters.sort || 'created_desc'} onChange={(v) => list.setFilter('sort', v === 'created_desc' ? null : v)} allowDeselect={false} />
          </Group>
        }
      />
      <VendorDrawer accountId={list.selected} onClose={() => list.open(null)} />
    </>
  );
}

function VendorDrawer({ accountId, onClose }: { accountId: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const q = useQuery({ queryKey: ['vendors', 'detail', accountId], queryFn: ({ signal }) => vendorsApi.detail(accountId!, signal), enabled: !!accountId });
  const v = q.data;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['vendors'] });
  const name = v ? nameOf(v) : 'Vendor';

  const verify = (on: boolean) =>
    open({
      title: on ? `Give ${name} the verified badge` : `Remove ${name}’s verified badge`,
      consequence: on
        ? 'Shoppers see a verified badge on the shop and its products. Only verify a shop whose identity and business documents have been checked.'
        : 'The verified badge disappears from the shop and its products straight away.',
      confirmLabel: on ? 'Verify shop' : 'Remove badge',
      danger: !on,
      run: () => (on ? verificationApi.verifyVendor(accountId!) : verificationApi.unverifyVendor(accountId!)),
      success: on ? 'Shop verified.' : 'Badge removed.',
      onDone: refresh,
    });

  return (
    <DetailDrawer
      opened={!!accountId}
      onClose={onClose}
      title={name}
      subtitle={v ? [v.displayName, v.businessType ? humanize(v.businessType) : null].filter(Boolean).join(' · ') : undefined}
      badges={
        v && (
          <>
            {v.isVerified && (
              <Badge color="forest" variant="light" leftSection={<IconDiscountCheck size={12} />}>
                Verified
              </Badge>
            )}
            {v.isSuspended ? <Badge color="signal">Suspended</Badge> : v.profile && <StatusBadge value={v.profile.status} />}
          </>
        )
      }
      actions={
        v && (
          <>
            {can('verifyVendors') && !v.isSuspended && (
              <Button size="sm" variant={v.isVerified ? 'default' : 'filled'} leftSection={<IconDiscountCheck size={16} />} onClick={() => verify(!v.isVerified)}>
                {v.isVerified ? 'Remove badge' : 'Verify shop'}
              </Button>
            )}
            {can('suspendVendors') &&
              (v.isSuspended ? (
                <Button
                  size="sm"
                  leftSection={<IconPlayerPlay size={16} />}
                  onClick={() =>
                    open({
                      title: `Reinstate ${name}`,
                      consequence: 'The vendor can sign in again and their products come back - except listings an admin took down individually, which stay down.',
                      confirmLabel: 'Reinstate vendor',
                      fields: [{ name: 'note', kind: 'textarea', label: 'Note (audit log)' }],
                      run: (f) => vendorsApi.reinstate(accountId!, f.note?.trim() || null),
                      success: 'Vendor reinstated.',
                      onDone: refresh,
                    })
                  }
                >
                  Reinstate
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="light"
                  color="signal"
                  leftSection={<IconPlayerPause size={16} />}
                  onClick={() =>
                    open({
                      title: `Suspend ${name}`,
                      consequence: 'The vendor is signed out and cannot sign in, and every live product is hidden from shoppers until you reinstate them. Open orders continue.',
                      confirmLabel: 'Suspend vendor',
                      danger: true,
                      fields: [{ name: 'reason', kind: 'textarea', label: 'Reason (audit log)', required: true, minLength: 3 }],
                      run: (f) => vendorsApi.suspend(accountId!, f.reason!.trim()),
                      success: 'Vendor suspended.',
                      onDone: refresh,
                    })
                  }
                >
                  Suspend…
                </Button>
              ))}
            {can('viewProducts') && (
              <Button size="sm" variant="default" leftSection={<IconShirt size={16} />} component={Link} to={`/products?vendor=${encodeURIComponent(accountId!)}`}>
                Products
              </Button>
            )}
            {can('viewOrders') && (
              <Button size="sm" variant="default" leftSection={<IconReceipt size={16} />} component={Link} to={`/orders?vendor=${encodeURIComponent(accountId!)}`}>
                Orders
              </Button>
            )}
          </>
        )
      }
    >
      {dialog}
      {q.error ? (
        <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />
      ) : !v ? (
        <Stack>
          <Skeleton height={90} radius="lg" />
          <Skeleton height={220} radius="lg" />
        </Stack>
      ) : (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
            <MetricTile label="Live products" value={v.products ? fmtNumber(v.products.active) : '—'} hint={v.products ? `${v.products.total} in total` : undefined} tone="forest" />
            <MetricTile label="Orders 30d" value={v.orders ? fmtNumber(v.orders.last30d.count) : '—'} tone="gray" />
            <MetricTile label="Sales 30d" value={v.orders ? fmtMoney(v.orders.last30d.gmv.amount, v.orders.last30d.gmv.currency) : '—'} tone="gray" />
            <MetricTile
              label="Payouts pending"
              value={v.payouts ? fmtMoney(v.payouts.pendingAmount.amount, v.payouts.pendingAmount.currency) : '—'}
              hint={v.payouts?.isOnHold ? `${v.payouts.heldCount} on hold` : undefined}
              tone={v.payouts?.isOnHold ? 'amber' : 'gray'}
            />
          </SimpleGrid>

          <SectionCard title="Business">
            <FieldGrid
              fields={[
                { label: 'Email', value: v.contact ? `${v.contact.email ?? v.contact.emailMasked ?? '—'}${v.contact.emailVerified ? '' : ' (unverified)'}` : null },
                { label: 'Phone', value: v.contact ? `${v.contact.phone ?? v.contact.phoneMasked ?? '—'}${v.contact.phoneVerified ? '' : ' (unverified)'}` : null },
                {
                  label: 'Website',
                  value: v.websiteUrl ? (
                    <Anchor href={/^https?:\/\//i.test(v.websiteUrl) ? v.websiteUrl : `https://${v.websiteUrl}`} target="_blank" rel="noopener noreferrer nofollow" size="sm">
                      {v.websiteUrl}
                    </Anchor>
                  ) : null,
                },
                { label: 'Account', value: v.accountStatus ? humanize(v.accountStatus) : null },
                {
                  label: 'Commission',
                  value: v.profile?.commissionRangeMin != null ? `${fmtPercent(v.profile.commissionRangeMin, 0, { fraction: true })} – ${fmtPercent(v.profile.commissionRangeMax, 0, { fraction: true })}` : null,
                },
                { label: 'Pickup', value: v.profile?.isPickupEnabled ? [v.profile.pickupAddressLine, v.profile.pickupCity].filter(Boolean).join(', ') : v.profile ? 'Off' : null },
                { label: 'Approved', value: <When value={v.profile?.approvalUtc ?? null} /> },
                { label: 'Verified', value: <When value={v.verifiedUtc} /> },
                { label: 'Last active', value: <When value={v.lastActiveUtc} relative /> },
                { label: 'Tagline', value: v.tagline, wide: true },
                { label: 'Rejection reason', value: v.profile?.rejectionReason ?? v.application?.rejectionReason, wide: true },
                { label: 'Account ID', value: <IdText value={v.accountId} /> },
              ]}
            />
          </SectionCard>

          {(v.kyc?.latest || v.application) && (
            <SectionCard
              title="Application & KYC"
              action={
                v.kyc?.latest &&
                can('viewKyc') && (
                  <Button size="xs" variant="light" component={Link} to={`/kyc?tab=vendors&state=all&open=${encodeURIComponent(v.kyc.latest.kycItemId)}`}>
                    Open KYC case
                  </Button>
                )
              }
            >
              <FieldGrid
                fields={[
                  { label: 'Application', value: v.application ? humanize(v.application.state) : null },
                  { label: 'Legal name', value: v.application?.legalBusinessName },
                  { label: 'Submitted', value: <When value={v.application?.submittedUtc ?? null} /> },
                  { label: 'KYC', value: v.kyc?.latest ? (v.kyc.latest.decision ? DECISION_LABEL[v.kyc.latest.decision] ?? humanize(v.kyc.latest.decision) : humanize(v.kyc.latest.state)) : null },
                  {
                    label: 'KYC reason',
                    value: v.kyc?.latest?.decisionReasonCode ? REASON_LABEL[v.kyc.latest.decisionReasonCode as KycReasonCode] ?? v.kyc.latest.decisionReasonCode : null,
                  },
                  { label: 'KYC decided', value: <When value={v.kyc?.latest?.decidedUtc ?? null} /> },
                ]}
              />
            </SectionCard>
          )}

          {v.orders && v.orders.recent.length > 0 && (
            <SectionCard title="Recent orders">
              <Table.ScrollContainer minWidth={460}>
                <Table aria-label="Recent orders">
                  <Table.Tbody>
                    {v.orders.recent.map((o) => (
                      <Table.Tr key={o.subOrderId}>
                        <Table.Td>
                          <Anchor component={Link} to={`/orders/${encodeURIComponent(o.orderNumber)}`} size="sm" className="sm-mono">
                            {o.orderNumber}
                          </Anchor>
                        </Table.Td>
                        <Table.Td>
                          <StatusBadge value={o.state} />
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{fmtMoney(o.subtotal.amount, o.subtotal.currency)}</Table.Td>
                        <Table.Td>
                          <When value={o.placedUtc} relative />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </SectionCard>
          )}

          {v.payouts && v.payouts.recent.length > 0 && (
            <SectionCard
              title="Payouts"
              description={`Paid in the last 30 days: ${fmtMoney(v.payouts.paidLast30dAmount.amount, v.payouts.paidLast30dAmount.currency)}`}
              action={
                can('viewPayouts') && (
                  <Button size="xs" variant="light" component={Link} to="/payouts">
                    Payout queue
                  </Button>
                )
              }
            >
              <Table aria-label="Recent payouts">
                <Table.Tbody>
                  {v.payouts.recent.map((p) => (
                    <Table.Tr key={p.payoutId}>
                      <Table.Td>{fmtMoney(p.netAmount.amount, p.netAmount.currency)}</Table.Td>
                      <Table.Td>
                        <StatusBadge value={p.state} />
                      </Table.Td>
                      <Table.Td>
                        <When value={p.paidUtc ?? p.requestedUtc} />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </SectionCard>
          )}

          {(v.stores.length > 0 || v.team.length > 0) && (
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              {v.stores.length > 0 && (
                <SectionCard title={`Stores (${v.stores.length})`}>
                  <Stack gap="xs">
                    {v.stores.map((s) => (
                      <TwoLine key={s.id} primary={`${s.name}${s.isActive ? '' : ' (inactive)'}`} secondary={[s.addressLine, s.city].filter(Boolean).join(', ')} />
                    ))}
                  </Stack>
                </SectionCard>
              )}
              {v.team.length > 0 && (
                <SectionCard title={`Team (${v.team.length})`}>
                  <Stack gap="xs">
                    {v.team.map((m) => (
                      <TwoLine key={m.memberAccountId} primary={m.displayName} secondary={`${humanize(m.role)} · ${humanize(m.status)}`} />
                    ))}
                  </Stack>
                </SectionCard>
              )}
            </SimpleGrid>
          )}
        </Stack>
      )}
    </DetailDrawer>
  );
}

/** Fallback while `GET /v1/admin/vendors` is not deployed: onboarding vendor applications (KYC reviewers only). */
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
    return <NotAvailableBlock what="The vendor directory" detail="GET /v1/admin/vendors is not deployed yet, and the onboarding applications it falls back to are open to KYC reviewers only." />;
  }

  const needle = list.searchInput.trim().toLowerCase();
  const page =
    query.data && needle ? { ...query.data, items: query.data.items.filter((a) => [a.brandName, a.legalBusinessName, a.city, a.accountId].some((x) => x?.toLowerCase().includes(needle))) } : query.data;

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
        Showing vendor <b>applications</b> from onboarding until the vendor directory is deployed. Sales, products and suspension appear then.
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
            <TextInput label="Filter this page" placeholder="Shop or legal name" leftSection={<IconSearch size={14} />} w={260} value={list.searchInput} onChange={(e) => list.setSearchInput(e.currentTarget.value)} />
          </Group>
        }
      />
      <ApplicationDrawer application={query.data?.items.find((a) => a.accountId === list.selected) ?? null} opened={!!list.selected} onClose={() => list.open(null)} />
    </Stack>
  );
}

function ApplicationDrawer({ application: a, opened, onClose }: { application: VendorApplication | null; opened: boolean; onClose: () => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  return (
    <DetailDrawer
      opened={opened}
      onClose={onClose}
      title={a?.brandName ?? 'Vendor'}
      subtitle={a?.legalBusinessName}
      badges={a && <StatusBadge value={APPLICATION_STATE[a.state]} />}
      actions={
        a &&
        can('verifyVendors') && (
          <Button
            size="sm"
            leftSection={<IconDiscountCheck size={16} />}
            onClick={() =>
              open({
                title: `Give ${a.brandName} the verified badge`,
                consequence: 'Shoppers see a verified badge on the shop and its products.',
                confirmLabel: 'Verify shop',
                run: () => verificationApi.verifyVendor(a.accountId),
                success: 'Shop verified.',
                onDone: () => void queryClient.invalidateQueries({ queryKey: ['vendors'] }),
              })
            }
          >
            Verify shop
          </Button>
        )
      }
    >
      {dialog}
      {!a ? (
        <Text size="sm" c="dimmed">
          This application isn’t on the current page any more.
        </Text>
      ) : (
        <Stack gap="lg">
          <SectionCard title="Business">
            <FieldGrid
              fields={[
                { label: 'Business type', value: BUSINESS_TYPE[a.businessType] },
                { label: 'Registration number', value: a.businessRegistrationNumber ? <span className="sm-mono">{mask(a.businessRegistrationNumber)}</span> : null },
                { label: 'Tax ID', value: a.taxId ? <span className="sm-mono">{mask(a.taxId)}</span> : null },
                { label: 'Address', value: [a.addressLine1, a.addressLine2, a.city, a.stateProvince, a.postalCode, a.countryCode].filter(Boolean).join(', '), wide: true },
                { label: 'Catalogue size', value: a.catalogSize ? CATALOG_SIZE[a.catalogSize] : null },
                { label: 'Price range', value: a.priceRangeMinAmount != null ? `${fmtMoney(a.priceRangeMinAmount, a.priceRangeCurrency)} – ${fmtMoney(a.priceRangeMaxAmount, a.priceRangeCurrency)}` : null },
                { label: 'Payout account', value: a.bankAccount ? `${a.bankAccount.bankName} •••• ${a.bankAccount.lastFourAccountDigits}` : null },
                { label: 'Submitted', value: <When value={a.submittedAtUtc} /> },
                { label: 'Decided', value: <When value={a.decisionAtUtc} /> },
                { label: 'Story', value: a.brandStory, wide: true },
                { label: 'Account', value: <IdText value={a.accountId} /> },
              ]}
            />
          </SectionCard>
        </Stack>
      )}
    </DetailDrawer>
  );
}
