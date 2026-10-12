import type { KeyboardEvent, ReactNode } from 'react';
import { Box, Button, Card, Group, Pagination, Select, Skeleton, Stack, Table, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import type { Page } from '@/api/paging';
import { EmptyBlock, ErrorBlock } from './StateBlocks';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
  /** Hide on narrow screens: the column is secondary. */
  visibleFrom?: 'sm' | 'md' | 'lg';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  page: Page<T> | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Accessible name for the table. */
  label: string;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  emptyTitle?: string;
  emptyBody?: string;
  /** Search or filters are applied: an empty result says "no matches", not "nothing". */
  filtered?: boolean;
  /** Above the table, inside the card: search and filters. */
  toolbar?: ReactNode;
  /** The currently selected row (drawer open), marked for screen readers and visually. */
  selectedKey?: string | null;
  isFetching?: boolean;
  /** Cursor lists can only step forward and back; page-numbered lists get numbered pages. */
  pagerMode?: 'pages' | 'cursor';
}

const PAGE_SIZES = ['10', '25', '50', '100'];

/**
 * The one list pattern: server-paged, with a toolbar, the four states, keyboard-openable rows and a pager. Every
 * list page is this plus its columns, so they all behave the same way.
 */
export function DataTable<T>(props: DataTableProps<T>) {
  const { columns, page, isLoading, error, rowKey, onRowClick, label, toolbar } = props;

  const hiddenStyle = (c: Column<T>) => (c.visibleFrom ? { visibleFrom: c.visibleFrom } : {});

  let body: ReactNode;
  if (isLoading) {
    body = (
      <Stack gap="md" p="lg" data-testid="table-skeleton" aria-busy="true" aria-label="Loading">
        {Array.from({ length: 6 }, (_, i) => (
          <Group key={i} justify="space-between" wrap="nowrap" gap="md">
            <Skeleton height={12} width="24%" radius="sm" />
            <Skeleton height={12} width="18%" radius="sm" />
            <Skeleton height={12} width="14%" radius="sm" />
            <Skeleton height={20} width={64} radius="sm" />
          </Group>
        ))}
      </Stack>
    );
  } else if (error) {
    body = (
      <Box p="lg">
        <ErrorBlock error={error} onRetry={props.onRetry} />
      </Box>
    );
  } else if (!page || page.items.length === 0) {
    body = <EmptyBlock title={props.emptyTitle} body={props.emptyBody} filtered={props.filtered} />;
  } else {
    const onKey = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
      if (!onRowClick) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onRowClick(row);
      }
    };
    body = (
      <Table.ScrollContainer minWidth={560} type="native">
        <Table aria-label={label} aria-busy={props.isFetching || undefined} stickyHeader>
          <Table.Thead>
            <Table.Tr>
              {columns.map((c) => (
                <Table.Th key={c.key} style={{ width: c.width, textAlign: c.align }} {...hiddenStyle(c)}>
                  {c.header}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {page.items.map((row) => {
              const key = rowKey(row);
              const selected = props.selectedKey === key;
              return (
                <Table.Tr
                  key={key}
                  className={onRowClick ? 'sm-row-clickable' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => onKey(e, row) : undefined}
                  aria-selected={onRowClick ? selected : undefined}
                  bg={selected ? 'var(--sm-active-bg)' : undefined}
                  data-testid="table-row"
                >
                  {columns.map((c) => (
                    <Table.Td key={c.key} style={{ textAlign: c.align }} {...hiddenStyle(c)}>
                      {c.render(row)}
                    </Table.Td>
                  ))}
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    );
  }

  return (
    <Card padding={0}>
      {toolbar && (
        <Box p="md" style={{ borderBottom: '1px solid var(--sm-border)' }}>
          {toolbar}
        </Box>
      )}
      {body}
      {page && !error && !isLoading && page.items.length > 0 && <Pager page={page} mode={props.pagerMode ?? 'pages'} onPageChange={props.onPageChange} onPageSizeChange={props.onPageSizeChange} />}
    </Card>
  );
}

function Pager<T>({
  page,
  mode,
  onPageChange,
  onPageSizeChange,
}: {
  page: Page<T>;
  mode: 'pages' | 'cursor';
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}) {
  const from = (page.page - 1) * page.pageSize + 1;
  const to = from + page.items.length - 1;
  const totalPages = mode === 'pages' && page.total !== undefined ? Math.max(1, Math.ceil(page.total / page.pageSize)) : undefined;
  return (
    <Group justify="space-between" p="md" gap="sm" wrap="wrap" style={{ borderTop: '1px solid var(--sm-border)' }} data-testid="pager">
      <Group gap="sm" wrap="nowrap">
        <Text size="sm" c="dimmed" aria-live="polite">
          {page.total !== undefined ? `${from.toLocaleString()}–${to.toLocaleString()} of ${page.total.toLocaleString()}` : `${from}–${to}`}
        </Text>
        {onPageSizeChange && (
          <Select
            aria-label="Rows per page"
            size="xs"
            w={84}
            data={PAGE_SIZES}
            value={String(page.pageSize)}
            onChange={(v) => v && onPageSizeChange(Number(v))}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
        )}
      </Group>
      {onPageChange &&
        (totalPages !== undefined ? (
          totalPages > 1 && (
            <Pagination
              size="sm"
              total={totalPages}
              value={page.page}
              onChange={onPageChange}
              siblings={1}
              getControlProps={(control) => ({ 'aria-label': `${control} page` })}
              getItemProps={(p) => ({ 'aria-label': `Page ${p}`, 'aria-current': p === page.page ? 'page' : undefined })}
            />
          )
        ) : (
          <Group gap="xs">
            <Button size="compact-sm" variant="default" leftSection={<IconChevronLeft size={14} />} disabled={page.page <= 1} onClick={() => onPageChange(page.page - 1)}>
              Previous
            </Button>
            <Button size="compact-sm" variant="default" rightSection={<IconChevronRight size={14} />} disabled={!page.hasMore} onClick={() => onPageChange(page.page + 1)}>
              Next
            </Button>
          </Group>
        ))}
    </Group>
  );
}
