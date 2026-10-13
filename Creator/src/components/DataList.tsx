import type { ReactNode } from 'react';
import { Card, Group, Stack, Table, Text, UnstyledButton } from '@mantine/core';
import { useIsPhone } from '../lib/useIsPhone';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Hidden from the phone card (the card shows `title`, `meta` and the rest). */
  hideOnCard?: boolean;
  width?: number | string;
}

/**
 * A table on a computer, a stack of cards on a phone — the same rows, never a sideways-scrolling table on a
 * small screen. `cardTitle` is the card's headline; the other columns become label/value lines.
 */
export function DataList<T>({
  items,
  columns,
  rowKey,
  onOpen,
  cardTitle,
  cardRight,
  caption,
  testId,
}: {
  items: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onOpen?: (row: T) => void;
  cardTitle?: (row: T) => ReactNode;
  cardRight?: (row: T) => ReactNode;
  caption?: string;
  testId?: string;
}) {
  const phone = useIsPhone();

  if (phone) {
    return (
      <Stack gap="sm" data-testid={testId} aria-label={caption}>
        {items.map((row) => {
          const body = (
            <Card padding="md" data-interactive={onOpen ? 'true' : undefined}>
              <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
                <div style={{ minWidth: 0, flex: 1 }}>{cardTitle ? cardTitle(row) : columns[0]?.render(row)}</div>
                {cardRight?.(row)}
              </Group>
              <Stack gap={4} mt="xs">
                {columns
                  .filter((c, i) => !c.hideOnCard && (cardTitle ? true : i > 0))
                  .map((c) => (
                    <Group key={c.key} justify="space-between" gap="sm" wrap="nowrap">
                      <Text size="xs" c="dimmed">
                        {c.header}
                      </Text>
                      <Text size="sm" ta="right" component="div" style={{ minWidth: 0 }}>
                        {c.render(row)}
                      </Text>
                    </Group>
                  ))}
              </Stack>
            </Card>
          );
          return onOpen ? (
            <UnstyledButton key={rowKey(row)} onClick={() => onOpen(row)} style={{ display: 'block', width: '100%' }}>
              {body}
            </UnstyledButton>
          ) : (
            <div key={rowKey(row)}>{body}</div>
          );
        })}
      </Stack>
    );
  }

  return (
    <Table.ScrollContainer minWidth={640}>
      <Table data-testid={testId}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <Table.Thead>
          <Table.Tr>
            {columns.map((c) => (
              <Table.Th key={c.key} style={{ textAlign: c.align ?? 'left', width: c.width }}>
                {c.header}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((row) => (
            <Table.Tr
              key={rowKey(row)}
              className={onOpen ? 'sm-row-link' : undefined}
              onClick={onOpen ? () => onOpen(row) : undefined}
              tabIndex={onOpen ? 0 : undefined}
              onKeyDown={
                onOpen
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpen(row);
                      }
                    }
                  : undefined
              }
            >
              {columns.map((c) => (
                <Table.Td key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                  {c.render(row)}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
