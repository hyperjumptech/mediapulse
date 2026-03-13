import { withAuthProtection } from "@/components/with-auth-protection";
import {
  getApiKeysPage,
  type ApiKeySortDir,
  type ApiKeySortField,
} from "@/lib/api-keys";

import { ListPagination } from "@/components/list-pagination";
import { AddApiKeyModal } from "./add-api-key-modal";
import { ApiKeysSearch } from "./api-keys-search";
import { ApiKeysTableWithEdit } from "./api-keys-table-with-edit";

const DEFAULT_PAGE_SIZE = 15;

const SORT_FIELDS: ApiKeySortField[] = ["name", "created"];
const SORT_DIRS: ApiKeySortDir[] = ["asc", "desc"];

const parseSort = (
  sort?: string,
  dir?: string,
): { sortBy: ApiKeySortField; sortDir: ApiKeySortDir } => {
  const sortBy = SORT_FIELDS.includes(sort as ApiKeySortField)
    ? (sort as ApiKeySortField)
    : "name";
  const sortDir = SORT_DIRS.includes(dir as ApiKeySortDir)
    ? (dir as ApiKeySortDir)
    : "asc";
  return { sortBy, sortDir };
};

/**
 * API keys list page. Fetches paginated API keys and renders table with edit/delete row actions.
 * Supports search by name and sort by name or created.
 */
const ApiKeysPage = async ({
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
    apiKeys,
    total,
    page: currentPage,
    pageSize: size,
  } = await getApiKeysPage(page, pageSize, { search, sortBy, sortDir });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between sm:flex-row sm:items-center">
        <ApiKeysSearch
          initialQuery={search ?? ""}
          pageSize={size}
          sortBy={sortBy}
          sortDir={sortDir}
        />
        <div className="shrink-0 sm:ml-auto">
          <AddApiKeyModal />
        </div>
      </div>
      <ApiKeysTableWithEdit
        apiKeys={apiKeys}
        sortBy={sortBy}
        sortDir={sortDir}
        pageSize={size}
        searchQuery={search}
      />
      <ListPagination
        basePath="/dashboard/api-keys"
        page={currentPage}
        pageSize={size}
        total={total}
        ariaLabel="API keys list pagination"
        searchQuery={search}
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </div>
  );
};

export default withAuthProtection(ApiKeysPage);
