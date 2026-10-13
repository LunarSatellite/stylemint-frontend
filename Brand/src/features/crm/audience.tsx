import { Alert, Group, Loader, Stack, Text } from '@mantine/core';
import { IconShieldCheck, IconUsers } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { ErrorBlock } from '../../components/StateBlocks';
import { formatNumber } from '../../lib/format';
import { crmApi, type CampaignPreview, type TargetFilter } from './api';
import { CRM_KEY } from './hooks';

/**
 * Saved and built-in audiences ("segments") are campaign target filters. Built-in ones ship with the
 * app; rule segments a seller creates are kept per CRM workspace in this browser until the backend
 * has a saved-segment endpoint.
 */
export interface RuleSegment {
  key: string;
  name: string;
  description?: string;
  filter: TargetFilter;
  builtIn?: boolean;
}

export const BUILT_IN_SEGMENTS: RuleSegment[] = [
  { key: 'all', name: 'All customers', description: 'Everyone who has bought from your shop.', filter: {}, builtIn: true },
  { key: 'active-30', name: 'Active this month', description: 'Ordered, reviewed or asked a question in the last 30 days.', filter: { lastSignalDaysAgo: 30 }, builtIn: true },
  { key: 'active-90', name: 'Active this quarter', description: 'Any activity in the last 90 days.', filter: { lastSignalDaysAgo: 90 }, builtIn: true },
  { key: 'vip', name: 'VIP', description: 'Customers you tagged “VIP”.', filter: { tags: ['VIP'], tagMatchMode: 'any' }, builtIn: true },
  { key: 'wholesale', name: 'Wholesale buyers', description: 'Customers with an open wholesale deal.', filter: { hasOpenDeals: true }, builtIn: true },
];

const storeKey = (tenantId: string) => `sm.seller.crm.segments.${tenantId}`;

export function loadSegments(tenantId: string | null): RuleSegment[] {
  if (!tenantId) return [];
  try {
    const raw = localStorage.getItem(storeKey(tenantId));
    const parsed = raw ? (JSON.parse(raw) as RuleSegment[]) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => s && typeof s.key === 'string' && typeof s.name === 'string') : [];
  } catch {
    return [];
  }
}

export function saveSegments(tenantId: string | null, segments: RuleSegment[]) {
  if (!tenantId) return;
  try {
    localStorage.setItem(storeKey(tenantId), JSON.stringify(segments.filter((s) => !s.builtIn)));
  } catch {
    /* storage blocked: the segment lasts for this page only */
  }
}

export function describeFilter(f: TargetFilter): string {
  const parts: string[] = [];
  if (f.tags?.length) parts.push(`${f.tagMatchMode === 'all' ? 'all of' : 'any of'} tags ${f.tags.join(', ')}`);
  if (f.cities?.length) parts.push(`in ${f.cities.join(', ')}`);
  if (f.lastSignalDaysAgo) parts.push(`active in the last ${f.lastSignalDaysAgo} days`);
  if (f.hasOpenDeals) parts.push('with an open wholesale deal');
  return parts.length ? parts.join(' · ') : 'All customers';
}

/** How many of the audience may be messaged: the backend's count, else the per-contact flags when complete. */
export function consentCount(p: CampaignPreview): number | null {
  if (typeof p.consentedRecipients === 'number') return p.consentedRecipients;
  const contacts = p.contacts ?? [];
  if (contacts.length === 0 && p.estimatedRecipients === 0) return 0;
  if (contacts.length < p.estimatedRecipients) return null;
  const flags = contacts.map((c) => c.canMessage ?? c.hasMarketingConsent ?? c.marketingConsent);
  if (flags.some((f) => f === undefined || f === null)) return null;
  return flags.filter(Boolean).length;
}

/** "120 customers · 84 agreed to marketing and will get it · 36 skipped". */
export function AudienceSummary({ filter }: { filter: TargetFilter }) {
  const json = JSON.stringify(filter);
  const preview = useQuery({ queryKey: [CRM_KEY, 'audience', json], queryFn: () => crmApi.previewAudience(filter), staleTime: 60_000 });
  if (preview.isPending)
    return (
      <Group gap="xs" data-testid="audience-loading">
        <Loader size="xs" color="forest" />
        <Text size="sm" c="dimmed">
          Counting customers…
        </Text>
      </Group>
    );
  if (preview.error) return <ErrorBlock error={preview.error} title="Could not count this audience" onRetry={() => void preview.refetch()} />;
  const p = preview.data!;
  const consented = consentCount(p);
  const skipped = consented === null ? null : Math.max(0, p.estimatedRecipients - consented);
  return (
    <Stack gap={6} data-testid="audience-summary">
      <Group gap={8} wrap="nowrap">
        <IconUsers size={16} aria-hidden />
        <Text size="sm">
          <b>{formatNumber(p.estimatedRecipients)}</b> {p.estimatedRecipients === 1 ? 'customer matches' : 'customers match'}
        </Text>
      </Group>
      {consented !== null ? (
        <Group gap={8} wrap="nowrap" data-testid="consent-count">
          <IconShieldCheck size={16} color="var(--mantine-color-forest-6)" aria-hidden />
          <Text size="sm">
            <b>{formatNumber(consented)}</b> agreed to marketing and will get it
            {skipped ? ` · ${formatNumber(skipped)} skipped (no consent)` : ''}
          </Text>
        </Group>
      ) : (
        <Alert variant="light" color="gray" p="xs" data-testid="consent-unknown">
          <Text size="xs">Consent is checked when sending: only customers who agreed to marketing receive it.</Text>
        </Alert>
      )}
    </Stack>
  );
}
