import { withAuthProtection } from "@/components/with-auth-protection";
import {
  getVariablesPage,
  type VariableSortDir,
  type VariableSortField,
} from "@/lib/variables";

import { ListPagination } from "@/components/list-pagination";
import { Button } from "@workspace/ui/components/button";
import { VariableModal } from "./variable-modal";
import { VariablesSearch } from "./variables-search";
import { VariablesTableWithEdit } from "./variables-table-with-edit";

const DEFAULT_PAGE_SIZE = 15;

const SORT_FIELDS: VariableSortField[] = ["key", "created"];
const SORT_DIRS: VariableSortDir[] = ["asc", "desc"];

const parseSort = (
  sort?: string,
  dir?: string,
): { sortBy: VariableSortField; sortDir: VariableSortDir } => {
  const sortBy = SORT_FIELDS.includes(sort as VariableSortField)
    ? (sort as VariableSortField)
    : "key";
  const sortDir = SORT_DIRS.includes(dir as VariableSortDir)
    ? (dir as VariableSortDir)
    : "asc";
  return { sortBy, sortDir };
};

/**
 * Variables list page. Fetches paginated variables and renders table with edit/delete row actions.
 * Supports search by key and sort by key or created. Secret values are shown as masked.
 */
const VariablesPage = async ({
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
    variables,
    total,
    page: currentPage,
    pageSize: size,
  } = await getVariablesPage(page, pageSize, { search, sortBy, sortDir });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between sm:flex-row sm:items-center">
        <VariablesSearch
          initialQuery={search ?? ""}
          pageSize={size}
          sortBy={sortBy}
          sortDir={sortDir}
        />
        <div className="shrink-0 sm:ml-auto">
          <VariableModal
            variable={null}
            trigger={<Button>Add variable</Button>}
          />
        </div>
      </div>
      <VariablesTableWithEdit
        variables={variables}
        sortBy={sortBy}
        sortDir={sortDir}
        pageSize={size}
        searchQuery={search}
      />
      <ListPagination
        basePath="/dashboard/variables"
        page={currentPage}
        pageSize={size}
        total={total}
        ariaLabel="Variables list pagination"
        searchQuery={search}
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </div>
  );
};

export default withAuthProtection(VariablesPage);
