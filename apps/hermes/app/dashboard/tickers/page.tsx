import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import {
  getTickersPage,
  type TickerSortDir,
  type TickerSortField,
} from "@/lib/tickers";

import { ListPagination } from "@/components/list-pagination";
import { AddImportTickersModal } from "./add-import-tickers-modal";
import { TickersSearch } from "./tickers-search";
import { TickersTable } from "./tickers-table";

const DEFAULT_PAGE_SIZE = 15;

const SORT_FIELDS: TickerSortField[] = ["symbol", "name", "created"];
const SORT_DIRS: TickerSortDir[] = ["asc", "desc"];

const parseSort = (
  sort?: string,
  dir?: string,
): { sortBy: TickerSortField; sortDir: TickerSortDir } => {
  const sortBy = SORT_FIELDS.includes(sort as TickerSortField)
    ? (sort as TickerSortField)
    : "symbol";
  const sortDir = SORT_DIRS.includes(dir as TickerSortDir)
    ? (dir as TickerSortDir)
    : "asc";
  return { sortBy, sortDir };
};

/**
 * Tickers list page. Fetches paginated tickers and renders table with edit/delete row actions.
 * Supports search by ticker symbol or company name (partial, case-insensitive) and sort by symbol, name, or created.
 */
const TickersPage = async ({
  searchParams,
}: {
  searchParams:
    | Promise<{
        page?: string;
        size?: string;
        q?: string;
        sort?: string;
        dir?: string;
      }>
    | { page?: string; size?: string; q?: string; sort?: string; dir?: string };
}) => {
  const resolved = await Promise.resolve(searchParams);
  const page = Math.max(1, parseInt(resolved.page ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      parseInt(resolved.size ?? String(DEFAULT_PAGE_SIZE), 10) ||
        DEFAULT_PAGE_SIZE,
    ),
  );
  const search = resolved.q?.trim() ?? undefined;
  const { sortBy, sortDir } = parseSort(resolved.sort, resolved.dir);

  const {
    tickers,
    total,
    page: currentPage,
    pageSize: size,
  } = await getTickersPage(page, pageSize, { search, sortBy, sortDir });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Tickers"
        description="Manage ticker symbols and company names for data sources."
      />
      <div className="flex flex-col justify-between sm:flex-row sm:items-center">
        <TickersSearch
          initialQuery={search ?? ""}
          pageSize={size}
          sortBy={sortBy}
          sortDir={sortDir}
        />
        <div className="shrink-0 sm:ml-auto">
          <AddImportTickersModal />
        </div>
      </div>
      <TickersTable
        tickers={tickers}
        sortBy={sortBy}
        sortDir={sortDir}
        pageSize={size}
        searchQuery={search}
      />
      <ListPagination
        basePath="/dashboard/tickers"
        page={currentPage}
        pageSize={size}
        total={total}
        ariaLabel="Tickers list pagination"
        searchQuery={search}
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </div>
  );
};

export default withAuthProtection(TickersPage);
