import { withAuthProtection } from "@/components/with-auth-protection";
import { getTickersPage } from "@/lib/tickers";

import { AddImportTickersModal } from "./add-import-tickers-modal";
import { Pagination } from "./pagination";
import { TickersSearch } from "./tickers-search";
import { TickersTable } from "./tickers-table";

const DEFAULT_PAGE_SIZE = 10;

/**
 * Tickers list page. Fetches paginated tickers and renders table with edit/delete row actions.
 * Supports search by ticker symbol or company name (partial, case-insensitive).
 */
const TickersPage = async ({
  searchParams,
}: {
  searchParams:
    | Promise<{ page?: string; size?: string; q?: string }>
    | { page?: string; size?: string; q?: string };
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

  const {
    tickers,
    total,
    page: currentPage,
    pageSize: size,
  } = await getTickersPage(page, pageSize, { search });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between sm:flex-row sm:items-center">
        <TickersSearch initialQuery={search ?? ""} pageSize={size} />
        <div className="shrink-0 sm:ml-auto">
          <AddImportTickersModal />
        </div>
      </div>
      <TickersTable tickers={tickers} />
      <Pagination
        basePath="/dashboard/tickers"
        page={currentPage}
        pageSize={size}
        total={total}
        searchQuery={search}
      />
    </div>
  );
};

export default withAuthProtection(TickersPage);
