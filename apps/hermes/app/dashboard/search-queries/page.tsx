import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import { getSearchQueriesPage } from "@/lib/search-queries";

import { SearchQueriesFilter } from "./search-queries-filter";
import { SearchQueriesTable } from "./search-queries-table";

const DEFAULT_PAGE_SIZE = 15;

/**
 * Search Query list page. Fetches paginated search-query rows and supports filtering by ticker name.
 */
const SearchQueriesPage = async ({
  searchParams,
}: {
  searchParams:
    | Promise<{ page?: string; size?: string; ticker?: string }>
    | { page?: string; size?: string; ticker?: string };
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
  const tickerNameFilter = resolved.ticker?.trim() ?? undefined;

  const {
    searchQueries,
    total,
    page: currentPage,
    pageSize: size,
  } = await getSearchQueriesPage(page, pageSize, { tickerNameFilter });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Search Query"
        description="Manage generated search queries and remove unused rows."
      />
      <SearchQueriesFilter
        initialTickerName={tickerNameFilter ?? ""}
        pageSize={size}
      />
      <SearchQueriesTable searchQueries={searchQueries} />
      <ListPagination
        basePath="/dashboard/search-queries"
        page={currentPage}
        pageSize={size}
        total={total}
        ariaLabel="Search query list pagination"
        extraParams={
          tickerNameFilter ? { ticker: tickerNameFilter } : undefined
        }
      />
    </div>
  );
};

export default withAuthProtection(SearchQueriesPage);
