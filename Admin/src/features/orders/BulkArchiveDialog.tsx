import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Group, Modal, ScrollArea, SegmentedControl, Stack, Table, Text, TextInput, Textarea } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { IconAlertTriangle } from '@tabler/icons-react';
import { messageOf } from '@/api/errors';
import { ORDER_STATE, ordersApi, type OrderArchiveRequest, type OrderArchiveResult } from '@/api/orders';
import { fmtDate, fmtMoney } from '@/lib/format';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Hide (archive) or unhide a vendor's orders in bulk - for test and demo orders. Always a dry run first: the preview
 * lists exactly which orders would change, and the real call sends the same selection.
 */
export function BulkArchiveDialog({ opened, onClose, vendorAccountId }: { opened: boolean; onClose: () => void; vendorAccountId?: string }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'archive' | 'unarchive'>('archive');
  const [vendor, setVendor] = useState(vendorAccountId ?? '');
  const [before, setBefore] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<{ key: string; result: OrderArchiveResult } | null>(null);
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      setVendor(vendorAccountId ?? '');
      setPreview(null);
      setError(null);
    }
  }, [opened, vendorAccountId]);

  const body = (dryRun: boolean): OrderArchiveRequest => ({
    vendorAccountId: vendor.trim(),
    placedBefore: before ? before.toISOString() : null,
    reason: reason.trim() || null,
    dryRun,
  });
  const key = JSON.stringify({ ...body(true), mode });
  const valid = GUID.test(vendor.trim()) && (mode === 'unarchive' || reason.trim().length >= 5);
  const previewCurrent = preview?.key === key;

  const run = async (dryRun: boolean) => {
    setBusy(dryRun ? 'preview' : 'apply');
    setError(null);
    try {
      const call = mode === 'archive' ? ordersApi.archive : ordersApi.unarchive;
      const result = await call(body(dryRun));
      if (dryRun) setPreview({ key, result });
      else {
        notifications.show({ color: 'forest', title: 'Done', message: `${result.changedCount} order${result.changedCount === 1 ? '' : 's'} ${mode === 'archive' ? 'hidden' : 'unhidden'}.` });
        void queryClient.invalidateQueries({ queryKey: ['orders'] });
        onClose();
      }
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal opened={opened} onClose={() => !busy && onClose()} title={<Text fw={650}>Hide or unhide a vendor’s orders</Text>} size="xl">
      <Stack gap="md">
        <Text size="sm">
          Hidden orders leave every list and report but are not deleted. Preview first - nothing changes until you confirm.
        </Text>
        <SegmentedControl
          value={mode}
          onChange={(v) => {
            setMode(v as 'archive' | 'unarchive');
            setPreview(null);
          }}
          data={[
            { value: 'archive', label: 'Hide orders' },
            { value: 'unarchive', label: 'Unhide orders' },
          ]}
        />
        <Group grow align="flex-start">
          <TextInput
            label="Vendor account ID"
            required
            value={vendor}
            onChange={(e) => setVendor(e.currentTarget.value)}
            error={vendor && !GUID.test(vendor.trim()) ? 'Paste the vendor’s account ID' : undefined}
          />
          <DateInput label="Placed before (optional)" clearable value={before} onChange={setBefore} maxDate={new Date()} />
        </Group>
        <Textarea
          label="Reason"
          required={mode === 'archive'}
          description="Recorded on every order and in the audit log."
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          placeholder="e.g. Test orders placed while setting up the shop"
        />
        {error && (
          <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
            {error}
          </Alert>
        )}
        {previewCurrent && preview && (
          <Stack gap="xs">
            <Group gap="sm">
              <Badge variant="light" color="slate">
                {preview.result.matchedCount} matched
              </Badge>
              <Badge variant="light" color={mode === 'archive' ? 'amber' : 'forest'}>
                {preview.result.changedCount} would change
              </Badge>
              <Badge variant="light" color="gray">
                {preview.result.unchangedCount} already {mode === 'archive' ? 'hidden' : 'visible'}
              </Badge>
            </Group>
            <ScrollArea.Autosize mah={280}>
              <Table aria-label="Orders in the preview" verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Order</Table.Th>
                    <Table.Th>Buyer</Table.Th>
                    <Table.Th>State</Table.Th>
                    <Table.Th>Placed</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Total</Table.Th>
                    <Table.Th>Change</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {preview.result.orders.map((o) => (
                    <Table.Tr key={o.orderId}>
                      <Table.Td className="sm-mono">{o.orderNumber}</Table.Td>
                      <Table.Td>{o.buyerName}</Table.Td>
                      <Table.Td>{ORDER_STATE[o.state]}</Table.Td>
                      <Table.Td>{fmtDate(o.placedUtc)}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{fmtMoney(o.grandTotalAmount, o.currency)}</Table.Td>
                      <Table.Td>{o.changes ? <Badge size="xs">Yes</Badge> : <Text size="xs" c="dimmed">No</Text>}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          </Stack>
        )}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={!!busy}>
            Cancel
          </Button>
          <Button variant="light" onClick={() => void run(true)} loading={busy === 'preview'} disabled={!valid || busy === 'apply'}>
            Preview
          </Button>
          <Button
            color={mode === 'archive' ? 'signal' : 'forest'}
            onClick={() => void run(false)}
            loading={busy === 'apply'}
            disabled={!valid || !previewCurrent || !preview || preview.result.changedCount === 0 || busy === 'preview'}
          >
            {mode === 'archive' ? 'Hide' : 'Unhide'} {previewCurrent && preview ? preview.result.changedCount : ''} orders
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
