import { withAuthProtection } from "@/components/with-auth-protection";
import { getTickersPage } from "@/lib/tickers";

import { Pagination } from "./pagination";
import { TickersTable } from "./tickers-table";

const DEFAULT_PAGE_SIZE = 10;

/**
 * Tickers list page. Fetches paginated tickers and renders table with edit/delete row actions.
 */
const TickersPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string }> | { page?: string; size?: string };
}) => {
  const resolved = await Promise.resolve(searchParams);
  const page = Math.max(1, parseInt(resolved.page ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(resolved.size ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));

  const { tickers, total, page: currentPage, pageSize: size } = await getTickersPage(page, pageSize);

  return (
    <div className="flex flex-col gap-4">
      <TickersTable tickers={tickers} />
      <Pagination
        basePath="/dashboard/tickers"
        page={currentPage}
        pageSize={size}
        total={total}
      />
    </div>
  );
};

export default withAuthProtection(TickersPage);
