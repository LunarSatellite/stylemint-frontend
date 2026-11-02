import { Badge, Box, Button, Group, Image, Stack, Text, Card } from '@mantine/core';
import { IconLink, IconPackages, IconTools } from '@tabler/icons-react';
import { formatMoney } from '../../lib/format';
import { toastError, toastSuccess } from '../../lib/notify';
import {
  acceptedCount,
  activeShops,
  isPurchasable,
  pausedReasonLabel,
  shareUrl,
  shopStateColor,
  shopStateLabel,
  stateColor,
  stateLabel,
  type Bundle,
  type BundleItem,
  type BundleState,
  type BundleTotals,
  type ShopState,
} from './api';

/** Every bundle endpoint answers a bare 404 until the backend is deployed. */
export function BundlesSettingUp() {
  return (
    <Card withBorder data-testid="state-setting-up">
      <Stack align="center" gap={6} py="lg" ta="center">
        <IconTools size={28} opacity={0.6} aria-hidden />
        <Text fw={600}>Bundles are being set up</Text>
        <Text size="sm" c="dimmed" maw={480}>
          StyleMint is switching on multi-shop bundles. You will be able to sell your products together with other shops at a
          bundle discount here as soon as it is ready.
        </Text>
      </Stack>
    </Card>
  );
}

export function BundleStateBadge({ state }: { state: BundleState }) {
  return (
    <Badge variant="light" color={stateColor[state]} size="sm" data-testid="bundle-state">
      {stateLabel[state]}
    </Badge>
  );
}

export function ShopStateBadge({ state }: { state: ShopState }) {
  return (
    <Badge variant="light" color={shopStateColor[state]} size="sm">
      {shopStateLabel[state]}
    </Badge>
  );
}

export function CoverThumb({ url, size = 56, label }: { url: string | null; size?: number; label?: string }) {
  return url ? (
    <Image src={url} alt={label ?? ''} w={size} h={size} radius="md" fit="cover" style={{ flexShrink: 0 }} />
  ) : (
    <Box
      w={size}
      h={size}
      aria-hidden
      style={{ borderRadius: 8, background: 'var(--sm-surface-muted, var(--mantine-color-gray-1))', display: 'grid', placeItems: 'center', flexShrink: 0 }}
    >
      <IconPackages size={Math.max(16, size / 3)} opacity={0.45} />
    </Box>
  );
}

/** "Rs 12,000 → Rs 10,800" for one unit; the list price is struck through when there is a discount. */
export function PriceLine({ list, bundle, quantity }: { list: number; bundle: number; quantity?: number }) {
  return (
    <Group gap={6} wrap="nowrap">
      {bundle < list && (
        <Text size="xs" c="dimmed" td="line-through">
          {formatMoney(list)}
        </Text>
      )}
      <Text size="sm" fw={650}>
        {formatMoney(bundle)}
      </Text>
      {quantity && quantity > 1 ? (
        <Text size="xs" c="dimmed">
          × {quantity}
        </Text>
      ) : null}
    </Group>
  );
}

export function TotalsLine({ totals }: { totals: BundleTotals | null }) {
  if (!totals) return null;
  const money = (n: number) => formatMoney({ amount: n, currency: totals.currency });
  return (
    <Group gap="lg" wrap="wrap" data-testid="bundle-totals">
      <Stack gap={0}>
        <Text size="xs" c="dimmed">
          Bought separately
        </Text>
        <Text fw={600} td={totals.saving > 0 ? 'line-through' : undefined}>
          {money(totals.listTotal)}
        </Text>
      </Stack>
      <Stack gap={0}>
        <Text size="xs" c="dimmed">
          Bundle price
        </Text>
        <Text fw={650}>{money(totals.bundleTotal)}</Text>
      </Stack>
      <Stack gap={0}>
        <Text size="xs" c="dimmed">
          Buyer saves
        </Text>
        <Text fw={600} c="forest">
          {money(totals.saving)}
        </Text>
      </Stack>
    </Group>
  );
}

export function AvailabilityBadge({ item }: { item: Pick<BundleItem, 'available'> }) {
  return item.available ? null : (
    <Badge variant="light" color="amber" size="sm">
      Out of stock
    </Badge>
  );
}

/** One sentence under the title: where the bundle is and what happens next. */
export function stateExplanation(b: Bundle): string {
  const open = activeShops(b);
  switch (b.state) {
    case 'Draft':
      return 'Only you can see this draft. Add 2–12 items, then send it to the shops to accept.';
    case 'PendingAcceptance': {
      const done = acceptedCount(b);
      return `${done} of ${open.length} ${open.length === 1 ? 'shop has' : 'shops have'} accepted terms version ${b.termsVersion}. It goes live automatically when every shop accepts.`;
    }
    case 'Live':
      return isPurchasable(b) ? 'On sale: buyers can add the whole bundle to their cart.' : 'Live, but buyers cannot buy it right now because an item is out of stock.';
    case 'Paused':
      return b.pausedReason ? pausedReasonLabel[b.pausedReason] : 'Paused: buyers cannot buy it.';
    case 'Archived':
      return 'Archived: buyers no longer see it and it cannot be changed.';
    default:
      return '';
  }
}

/** Names of the items that keep a live bundle from being bought. */
export function unavailableItems(b: Bundle): string[] {
  return b.items.filter((i) => !i.available).map((i) => i.title);
}

export async function copyShareLink(id: string) {
  const url = shareUrl(id);
  try {
    await navigator.clipboard.writeText(url);
    toastSuccess(`Link copied: ${url}`);
  } catch {
    toastError(new Error(`Copy did not work. The link is ${url}`));
  }
}

export function ShareLinkButton({ id }: { id: string }) {
  return (
    <Button variant="default" leftSection={<IconLink size={16} />} onClick={() => void copyShareLink(id)}>
      Copy share link
    </Button>
  );
}
