import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import { customersApi } from '@/api/people';
import { installSession, resetSessionForTests } from '@/auth/session';
import { useListState } from '@/hooks/useListState';
import { mockFetch, renderWithProviders, signInAs } from '@/test/utils';
import { DataTable, type Column } from './DataTable';

interface Row {
  id: string;
  name: string;
}
const columns: Column<Row>[] = [{ key: 'name', header: 'Name', render: (r) => r.name }];
const rows = (n: number, from = 1) => Array.from({ length: n }, (_, i) => ({ id: String(from + i), name: `Row ${from + i}` }));

afterEach(() => vi.unstubAllGlobals());

describe('DataTable states', () => {
  it('shows a skeleton while loading', () => {
    renderWithProviders(<DataTable label="T" columns={columns} page={undefined} isLoading error={null} rowKey={(r) => r.id} />);
    expect(screen.getByTestId('table-skeleton')).toBeInTheDocument();
  });

  it('says “couldn’t load”, never “nothing here”, when the request failed', () => {
    renderWithProviders(<DataTable label="T" columns={columns} page={undefined} isLoading={false} error={new ApiError({ status: 500, message: 'The server had a problem.' })} rowKey={(r) => r.id} emptyTitle="Nothing here" />);
    expect(screen.getByTestId('state-error')).toHaveTextContent('Couldn’t load this');
    expect(screen.queryByText('Nothing here')).not.toBeInTheDocument();
  });

  it('says the roles are missing on a 403', () => {
    renderWithProviders(<DataTable label="T" columns={columns} page={undefined} isLoading={false} error={new ApiError({ status: 403, code: 'auth.forbidden', message: 'x' })} rowKey={(r) => r.id} />);
    expect(screen.getByTestId('state-forbidden')).toBeInTheDocument();
  });

  it('separates “no matches” from “nothing yet”', () => {
    const empty = { items: [], total: 0, page: 1, pageSize: 25, hasMore: false };
    const { rerender } = renderWithProviders(<DataTable label="T" columns={columns} page={empty} isLoading={false} error={null} rowKey={(r: Row) => r.id} emptyTitle="No customers yet" />);
    expect(screen.getByText('No customers yet')).toBeInTheDocument();
    rerender(<DataTable label="T" columns={columns} page={empty} isLoading={false} error={null} rowKey={(r: Row) => r.id} emptyTitle="No customers yet" filtered />);
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('opens a row by click and by keyboard', async () => {
    const onRowClick = vi.fn();
    renderWithProviders(<DataTable label="T" columns={columns} page={{ items: rows(2), total: 2, page: 1, pageSize: 25, hasMore: false }} isLoading={false} error={null} rowKey={(r) => r.id} onRowClick={onRowClick} />);
    const [first, second] = screen.getAllByTestId('table-row');
    await userEvent.click(first!);
    second!.focus();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick.mock.calls.map((c) => (c[0] as Row).id)).toEqual(['1', '2']);
  });
});

describe('paging', () => {
  it('numbers pages for counted lists and reports the range', async () => {
    const onPageChange = vi.fn();
    renderWithProviders(<DataTable label="T" columns={columns} page={{ items: rows(25), total: 60, page: 1, pageSize: 25, hasMore: true }} isLoading={false} error={null} rowKey={(r) => r.id} onPageChange={onPageChange} />);
    expect(screen.getByTestId('pager')).toHaveTextContent('1–25 of 60');
    await userEvent.click(screen.getByRole('button', { name: 'Page 2' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('steps forward and back on cursor lists, with Next off on the last page', async () => {
    const onPageChange = vi.fn();
    const { rerender } = renderWithProviders(
      <DataTable label="T" pagerMode="cursor" columns={columns} page={{ items: rows(10), total: 15, page: 1, pageSize: 10, hasMore: true }} isLoading={false} error={null} rowKey={(r: Row) => r.id} onPageChange={onPageChange} />,
    );
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
    rerender(<DataTable label="T" pagerMode="cursor" columns={columns} page={{ items: rows(5, 11), total: 15, page: 2, pageSize: 10, hasMore: false }} isLoading={false} error={null} rowKey={(r: Row) => r.id} onPageChange={onPageChange} />);
    expect(screen.getByTestId('pager')).toHaveTextContent('11–15 of 15');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});

describe('a server-paged list end to end', () => {
  beforeEach(() => {
    installSession();
    resetSessionForTests();
    signInAs(['SupportAgent']);
  });

  function Customers() {
    const list = useListState(['status'] as const);
    const q = useQuery({
      queryKey: ['c', list.search, list.page, list.pageSize],
      queryFn: ({ signal }) => customersApi.list({ search: list.search, page: list.page, pageSize: list.pageSize }, signal),
      placeholderData: keepPreviousData,
    });
    return (
      <>
        <input aria-label="search" value={list.searchInput} onChange={(e) => list.setSearchInput(e.currentTarget.value)} />
        <DataTable label="Customers" columns={[{ key: 'n', header: 'Name', render: (r: { id: string; displayName: string }) => r.displayName }]} page={q.data} isLoading={q.isLoading} error={q.error} rowKey={(r) => r.id} onPageChange={list.setPage} filtered={list.filtered} />
      </>
    );
  }

  it('asks the server for the page and the search, and starts again at page 1 when the search changes', async () => {
    const { calls } = mockFetch((req) => {
      const url = new URL(req.url, 'http://x');
      const page = Number(url.searchParams.get('pageNumber'));
      return { body: { items: [{ id: `p${page}`, displayName: `Customer on page ${page}` }], totalCount: 120, pageNumber: page, pageSize: 25 } };
    });
    renderWithProviders(<Customers />, { route: '/customers' });
    expect(await screen.findByText('Customer on page 1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(await screen.findByText('Customer on page 3')).toBeInTheDocument();
    expect(calls.at(-1)!.url).toContain('pageNumber=3');
    expect(calls.at(-1)!.url).toContain('pageSize=25');

    await userEvent.type(screen.getByLabelText('search'), 'asha');
    await waitFor(() => expect(calls.at(-1)!.url).toContain('search=asha'));
    expect(calls.at(-1)!.url).toContain('pageNumber=1');
  });
});
