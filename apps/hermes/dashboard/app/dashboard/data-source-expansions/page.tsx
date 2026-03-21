import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import {
  getDataSourceExpansionsPage,
  type DataSourceExpansionSortDir,
  type DataSourceExpansionSortField,
} from "@/lib/data-source-expansions";

import { ListPagination } from "@/components/list-pagination";
import { Button } from "@workspace/ui/components/button";
import { DataSourceExpansionsSearch } from "./data-source-expansions-search";
import { DataSourceExpansionsTable } from "./data-source-expansions-table";

const DEFAULT_PAGE_SIZE = 15;

const SORT_FIELDS: DataSourceExpansionSortField[] = ["name", "created"];
const SORT_DIRS: DataSourceExpansionSortDir[] = ["asc", "desc"];

const parseSort = (
  sort?: string,
  dir?: string,
): {
  sortBy: DataSourceExpansionSortField;
  sortDir: DataSourceExpansionSortDir;
} => {
  const sortBy = SORT_FIELDS.includes(sort as DataSourceExpansionSortField)
    ? (sort as DataSourceExpansionSortField)
    : "name";
  const sortDir = SORT_DIRS.includes(dir as DataSourceExpansionSortDir)
    ? (dir as DataSourceExpansionSortDir)
    : "asc";
  return { sortBy, sortDir };
};

/**
 * Data source expansions list page. Fetches paginated expansions and renders table with search, sort, and pagination.
 */
const DataSourceExpansionsPage = async ({
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
    expansions,
    total,
    page: currentPage,
    pageSize: size,
  } = await getDataSourceExpansionsPage(page, pageSize, {
    search,
    sortBy,
    sortDir,
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Data source expansions"
        description="Manage data source expansion definitions."
      />
      <div className="flex flex-col justify-between sm:flex-row sm:items-center">
        <DataSourceExpansionsSearch
          initialQuery={search ?? ""}
          pageSize={size}
          sortBy={sortBy}
          sortDir={sortDir}
        />
        <div className="shrink-0 sm:ml-auto">
          <Button asChild>
            <Link href="/dashboard/data-source-expansions/new">
              Create expansion
            </Link>
          </Button>
        </div>
      </div>
      <DataSourceExpansionsTable
        expansions={expansions}
        sortBy={sortBy}
        sortDir={sortDir}
        pageSize={size}
        searchQuery={search}
      />
      <ListPagination
        basePath="/dashboard/data-source-expansions"
        page={currentPage}
        pageSize={size}
        total={total}
        ariaLabel="Data source expansions list pagination"
        searchQuery={search}
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </div>
  );
};

export default withAuthProtection(DataSourceExpansionsPage);
