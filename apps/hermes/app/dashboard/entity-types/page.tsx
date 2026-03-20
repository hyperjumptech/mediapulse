import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import { ListPagination } from "@/components/list-pagination";
import {
  getEntityTypesPage,
  type EntityTypeSortDir,
  type EntityTypeSortField,
} from "@/lib/entity-types";

import { Button } from "@workspace/ui/components/button";
import { EntityTypeModal } from "./entity-type-modal";
import { EntityTypesSearch } from "./entity-types-search";
import { EntityTypesTable } from "./entity-types-table";

const DEFAULT_PAGE_SIZE = 15;

const SORT_FIELDS: EntityTypeSortField[] = ["name", "created"];
const SORT_DIRS: EntityTypeSortDir[] = ["asc", "desc"];

const parseSort = (
  sort?: string,
  dir?: string,
): { sortBy: EntityTypeSortField; sortDir: EntityTypeSortDir } => {
  const sortBy = SORT_FIELDS.includes(sort as EntityTypeSortField)
    ? (sort as EntityTypeSortField)
    : "name";
  const sortDir = SORT_DIRS.includes(dir as EntityTypeSortDir)
    ? (dir as EntityTypeSortDir)
    : "asc";
  return { sortBy, sortDir };
};

/**
 * Entity types list page. Fetches paginated rows and renders table with edit/delete row actions.
 */
const EntityTypesPage = async ({
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
    entityTypes,
    total,
    page: currentPage,
    pageSize: size,
  } = await getEntityTypesPage(page, pageSize, {
    search,
    sortBy,
    sortDir,
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Entity Types"
        description="Manage vocabulary used by the knowledge graph entity classifier."
      />
      <div className="flex flex-col justify-between sm:flex-row sm:items-center">
        <EntityTypesSearch
          initialQuery={search ?? ""}
          pageSize={size}
          sortBy={sortBy}
          sortDir={sortDir}
        />
        <div className="shrink-0 sm:ml-auto">
          <EntityTypeModal
            entityType={null}
            trigger={<Button>Add entity type</Button>}
          />
        </div>
      </div>
      <EntityTypesTable
        entityTypes={entityTypes}
        sortBy={sortBy}
        sortDir={sortDir}
        pageSize={size}
        searchQuery={search}
      />
      <ListPagination
        basePath="/dashboard/entity-types"
        page={currentPage}
        pageSize={size}
        total={total}
        ariaLabel="Entity types list pagination"
        searchQuery={search}
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </div>
  );
};

export default withAuthProtection(EntityTypesPage);
