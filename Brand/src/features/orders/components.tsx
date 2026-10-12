import { Avatar, Badge, Card, Checkbox, Group, Stack, Text } from '@mantine/core';
import { IconBuildingStore, IconPackage } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { formatMoney, fromNow } from '../../lib/format';
import { stateColor, stateLabel, type SubOrderListItem } from './api';

export function OrderStateBadge({ state, size = 'sm' }: { state: number; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  return (
    <Badge color={stateColor[state] ?? 'gray'} variant="light" size={size}>
      {stateLabel[state] ?? `State ${state}`}
    </Badge>
  );
}

export function ChannelBadge({ channel }: { channel: string }) {
  if (channel !== 'StorePickup') return null;
  return (
    <Badge color="grape" variant="outline" size="sm" leftSection={<IconBuildingStore size={12} />}>
      Store pickup
    </Badge>
  );
}

/**
 * One order as a card — the phone layout of the orders list. In selection mode the card toggles
 * a checkbox instead of opening the order.
 */
export function OrderCard({
  order,
  selected,
  onToggle,
}: {
  order: SubOrderListItem;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const body = (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
        {onToggle ? (
          <Checkbox checked={!!selected} onChange={onToggle} aria-label={`Select order ${order.orderNumber}`} onClick={(e) => e.stopPropagation()} />
        ) : (
          <Avatar radius="md" color="forest" variant="light">
            <IconPackage size={20} />
          </Avatar>
        )}
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Text fw={650} size="sm">
            #{order.orderNumber}
          </Text>
          <Text size="sm" truncate>
            {order.receiverName}
          </Text>
          <Text size="xs" c="dimmed">
            {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'} · {fromNow(order.placedUtc)}
          </Text>
        </Stack>
      </Group>
      <Stack gap={6} align="flex-end" style={{ flexShrink: 0 }}>
        <Text fw={650} size="sm">
          {formatMoney({ amount: order.subtotalAmount, currency: order.subtotalCurrency })}
        </Text>
        <OrderStateBadge state={order.state} />
        <ChannelBadge channel={order.fulfillmentChannel} />
      </Stack>
    </Group>
  );
  if (onToggle) {
    return (
      <Card padding="md" onClick={onToggle} style={{ cursor: 'pointer' }} data-selected={selected || undefined}>
        {body}
      </Card>
    );
  }
  return (
    <Card padding="md" data-interactive="true" component={Link} to={`/orders/${order.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      {body}
    </Card>
  );
}
