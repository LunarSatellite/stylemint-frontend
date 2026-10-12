import { useState, type ReactNode } from 'react';
import { Anchor, Badge, Box, Button, Card, Group, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconExternalLink, IconEye, IconFileText, IconPhotoOff } from '@tabler/icons-react';
import { messageOf } from '@/api/errors';
import { fmtDateTime } from '@/lib/format';
import { toneOf } from './Bits';

export interface ViewerDoc {
  id: string;
  /** "Citizenship - front", "Selfie" */
  label: string;
  status?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  uploadedUtc?: string | null;
  filename?: string | null;
  rejectionReason?: string | null;
  /** Visually flagged, e.g. the selfie in a comparison. */
  emphasis?: boolean;
}

function isImage(contentType: string | null | undefined, url?: string) {
  if (contentType) return contentType.startsWith('image/');
  return !!url && /\.(png|jpe?g|webp|gif|heic|bmp)(\?|$)/i.test(url);
}

function kb(bytes: number | null | undefined) {
  if (!bytes && bytes !== 0) return '';
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * One document: its facts, and the file itself once asked for. Links are fetched only on request - each fetch is
 * written to the admin audit log, and an identity document should not be on screen until a reviewer means to look.
 */
export function DocumentTile({
  doc,
  fetchLink,
  queryKey,
  autoLoad = false,
}: {
  doc: ViewerDoc;
  fetchLink: (signal?: AbortSignal) => Promise<{ url: string }>;
  queryKey: readonly unknown[];
  autoLoad?: boolean;
}) {
  const [requested, setRequested] = useState(autoLoad);
  const link = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchLink(signal),
    enabled: requested || autoLoad,
    staleTime: 5 * 60_000,
    gcTime: 60_000,
    retry: false,
  });
  const show = requested || autoLoad;
  const url = link.data?.url;
  const image = isImage(doc.contentType, url);

  return (
    <Card padding="sm" withBorder style={doc.emphasis ? { borderColor: 'var(--mantine-color-forest-5)' } : undefined} data-testid="doc-tile">
      <Stack gap={8}>
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Text fw={600} size="sm" lineClamp={1} title={doc.label}>
            {doc.label}
          </Text>
          {doc.status && (
            <Badge size="xs" variant="light" color={toneOf(doc.status)}>
              {doc.status}
            </Badge>
          )}
        </Group>
        <Text size="xs" c="dimmed" lineClamp={1}>
          {[doc.filename, doc.contentType, kb(doc.sizeBytes), doc.uploadedUtc ? fmtDateTime(doc.uploadedUtc) : null].filter(Boolean).join(' · ')}
        </Text>
        {doc.rejectionReason && (
          <Text size="xs" c="signal">
            Rejected: {doc.rejectionReason}
          </Text>
        )}
        {!show ? (
          <Button size="xs" variant="light" leftSection={<IconEye size={14} />} onClick={() => setRequested(true)} aria-label={`View ${doc.label}`}>
            View
          </Button>
        ) : link.isLoading ? (
          <Skeleton height={220} radius="md" />
        ) : link.error ? (
          <Box className="sm-doc-frame" p="md">
            <Stack align="center" gap={4}>
              <IconPhotoOff size={22} opacity={0.6} aria-hidden />
              <Text size="xs" c="dimmed" ta="center">
                Couldn’t load the file: {messageOf(link.error)}
              </Text>
              <Button size="compact-xs" variant="subtle" onClick={() => void link.refetch()}>
                Try again
              </Button>
            </Stack>
          </Box>
        ) : url ? (
          image ? (
            <Anchor href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${doc.label} full size in a new tab`}>
              <Box className="sm-doc-frame">
                <img src={url} alt={doc.label} loading="lazy" referrerPolicy="no-referrer" />
              </Box>
            </Anchor>
          ) : (
            <Box className="sm-doc-frame" p="md">
              <Stack align="center" gap={6}>
                <IconFileText size={26} opacity={0.6} aria-hidden />
                <Anchor href={url} target="_blank" rel="noopener noreferrer" size="sm">
                  Open the file <IconExternalLink size={12} />
                </Anchor>
              </Stack>
            </Box>
          )
        ) : null}
      </Stack>
    </Card>
  );
}

/** Documents side by side (two or three across), so a photo ID and the selfie can be compared at a glance. */
export function DocumentGrid({ children, cols = 3 }: { children: ReactNode; cols?: number }) {
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: cols }} spacing="md">
      {children}
    </SimpleGrid>
  );
}
