import { Badge, Button, Group, Skeleton, Stack, Table, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconPlus } from '@tabler/icons-react';
import { ApiError } from '@/api/errors';
import { bookingsAdminApi, isGuid, SERVICE_CATEGORY, validPercent, type CommissionSettings } from '@/api/services';
import { useAuth } from '@/auth/guards';
import { useActionDialog } from '@/components/ActionDialog';
import { IdText, When } from '@/components/Bits';
import { EmptyBlock, ErrorBlock, NotAvailableBlock, SectionCard } from '@/components/StateBlocks';

const KEY = ['bookings', 'commission'];
/** Bookings carry commission for these two categories; banks pay none (no payments in v1). */
const BOOKING_CATEGORIES = [1, 2] as const;

const percentField = (defaultValue?: number) =>
  ({ name: 'percent', kind: 'number', label: 'Commission (%)', description: 'Between 0 and 50. Applies to new bookings only.', required: true, min: 0, max: 50, decimalScale: 2, defaultValue: defaultValue !== undefined ? String(defaultValue) : undefined }) as const;

function percentOrThrow(raw: string | undefined): number {
  const p = validPercent(raw ?? '');
  if (p === null) throw new Error('Enter a percent between 0 and 50.');
  return p;
}

/**
 * Commission per completed booking: the default, one rate per category (Hotel, Travel agency), and per-vendor
 * overrides. Resolution on the server: vendor override → category → default. The percent is snapshotted on each
 * booking when it is made, so a change here only affects new bookings.
 */
export function CommissionSettingsPanel() {
  const { can } = useAuth();
  const canEdit = can('manageBookings');
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const q = useQuery({ queryKey: KEY, queryFn: ({ signal }) => bookingsAdminApi.commission(signal), retry: false });
  const apply = (next: unknown) => {
    if (next && typeof next === 'object' && 'defaultPercent' in next) queryClient.setQueryData(KEY, next as CommissionSettings);
    else void queryClient.invalidateQueries({ queryKey: KEY });
  };

  if (q.error instanceof ApiError && q.error.isMissingEndpoint)
    return <NotAvailableBlock what="Booking commission settings" detail="The bookings module is not deployed on this server yet. Until then every booking would use the default of 10%." />;
  if (q.error) return <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data)
    return (
      <Stack>
        <Skeleton height={140} radius="lg" />
        <Skeleton height={180} radius="lg" />
      </Stack>
    );

  const s = q.data;
  const rowFor = (category: number) => s.categories.find((c) => c.category === category) ?? { category, percent: s.defaultPercent, isDefault: true };

  return (
    <Stack gap="lg">
      {dialog}
      <SectionCard title="By category" description={`Default for any booking without a rule: ${s.defaultPercent}%. Banks pay no commission (enquiries are free).`}>
        <Table aria-label="Commission by category">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Category</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Commission</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {BOOKING_CATEGORIES.map((category) => {
              const row = rowFor(category);
              return (
                <Table.Tr key={category} data-testid={`commission-category-${category}`}>
                  <Table.Td>
                    {SERVICE_CATEGORY[category]}{' '}
                    {row.isDefault && (
                      <Badge size="xs" variant="light" color="gray">
                        default
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{row.percent}%</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    {canEdit && (
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Button
                          size="compact-xs"
                          variant="light"
                          onClick={() =>
                            open({
                              title: `${SERVICE_CATEGORY[category]} commission`,
                              consequence: `New ${SERVICE_CATEGORY[category].toLowerCase()} bookings use this percent unless the vendor has an override. Existing bookings keep theirs.`,
                              confirmLabel: 'Save percent',
                              fields: [percentField(row.percent)],
                              run: (f) => bookingsAdminApi.setCategory(category, percentOrThrow(f.percent)),
                              success: 'Commission saved.',
                              onDone: apply,
                            })
                          }
                        >
                          Change
                        </Button>
                        {!row.isDefault && (
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color="slate"
                            onClick={() =>
                              open({
                                title: `Reset ${SERVICE_CATEGORY[category].toLowerCase()} commission`,
                                consequence: `New bookings go back to the default of ${s.defaultPercent}%.`,
                                confirmLabel: 'Reset to default',
                                run: () => bookingsAdminApi.resetCategory(category),
                                success: 'Back to the default.',
                                onDone: apply,
                              })
                            }
                          >
                            Reset
                          </Button>
                        )}
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </SectionCard>

      <SectionCard
        title="Vendor overrides"
        description="A negotiated rate for one hotel or travel agency. It beats the category rate."
        action={
          canEdit && (
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() =>
                open({
                  title: 'Add a vendor override',
                  consequence: 'New bookings with this vendor use this percent. Existing bookings keep theirs.',
                  confirmLabel: 'Save override',
                  fields: [
                    { name: 'vendor', kind: 'text', label: 'Vendor account ID', description: 'From the vendor’s page in Vendors.', required: true },
                    percentField(),
                    { name: 'note', kind: 'text', label: 'Note (why)', placeholder: 'Launch partner rate until March' },
                  ],
                  run: (f) => {
                    const vendor = (f.vendor ?? '').trim();
                    if (!isGuid(vendor)) throw new Error('That is not a vendor account ID.');
                    return bookingsAdminApi.setVendor(vendor, percentOrThrow(f.percent), f.note?.trim() || null);
                  },
                  success: 'Override saved.',
                  onDone: apply,
                })
              }
            >
              Add override
            </Button>
          )
        }
      >
        {s.vendors.length === 0 ? (
          <EmptyBlock title="No overrides" body="Every vendor pays its category rate." />
        ) : (
          <Table.ScrollContainer minWidth={560}>
            <Table aria-label="Vendor commission overrides">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Vendor</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Commission</Table.Th>
                  <Table.Th>Note</Table.Th>
                  <Table.Th>Updated</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {s.vendors.map((v) => (
                  <Table.Tr key={v.vendorAccountId} data-testid={`commission-vendor-${v.vendorAccountId}`}>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {v.vendorName ?? 'Vendor'}
                      </Text>
                      <IdText value={v.vendorAccountId} />
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{v.percent}%</Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" lineClamp={2}>
                        {v.note ?? '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <When value={v.updatedUtc} />
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      {canEdit && (
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          <Button
                            size="compact-xs"
                            variant="light"
                            onClick={() =>
                              open({
                                title: `Commission for ${v.vendorName ?? 'this vendor'}`,
                                consequence: 'New bookings with this vendor use this percent.',
                                confirmLabel: 'Save override',
                                fields: [percentField(v.percent), { name: 'note', kind: 'text', label: 'Note (why)', defaultValue: v.note ?? '' }],
                                run: (f) => bookingsAdminApi.setVendor(v.vendorAccountId, percentOrThrow(f.percent), f.note?.trim() || null),
                                success: 'Override saved.',
                                onDone: apply,
                              })
                            }
                          >
                            Change
                          </Button>
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color="signal"
                            onClick={() =>
                              open({
                                title: `Remove the override for ${v.vendorName ?? 'this vendor'}`,
                                consequence: 'New bookings with this vendor use the category rate again.',
                                confirmLabel: 'Remove override',
                                danger: true,
                                run: () => bookingsAdminApi.removeVendor(v.vendorAccountId),
                                success: 'Override removed.',
                                onDone: apply,
                              })
                            }
                          >
                            Remove
                          </Button>
                        </Group>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </SectionCard>
    </Stack>
  );
}
