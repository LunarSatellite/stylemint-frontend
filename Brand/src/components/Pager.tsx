import { Button, Group, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

/** Previous / next under a cursor-paged list, with "21–40 of 132". */
export function Pager({
  page,
  pageSize,
  total,
  shown,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  busy,
}: {
  page: number;
  pageSize: number;
  total: number | null | undefined;
  shown: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  busy?: boolean;
}) {
  if (!hasPrev && !hasNext) {
    return total ? (
      <Text size="xs" c="dimmed" mt="sm">
        {total} {total === 1 ? 'item' : 'items'}
      </Text>
    ) : null;
  }
  const from = (page - 1) * pageSize + 1;
  const to = from + Math.max(0, shown - 1);
  return (
    <Group justify="space-between" mt="md" gap="sm" wrap="wrap" aria-label="Pages">
      <Text size="xs" c="dimmed">
        {shown > 0 ? `${from}–${to}` : '0'}
        {total ? ` of ${total}` : ''}
      </Text>
      <Group gap="xs">
        <Button
          variant="default"
          size="xs"
          leftSection={<IconChevronLeft size={14} />}
          disabled={!hasPrev || busy}
          onClick={onPrev}
        >
          Previous
        </Button>
        <Button
          variant="default"
          size="xs"
          rightSection={<IconChevronRight size={14} />}
          disabled={!hasNext || busy}
          onClick={onNext}
        >
          Next
        </Button>
      </Group>
    </Group>
  );
}
