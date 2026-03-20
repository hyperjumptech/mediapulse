import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import { ListPagination } from "@/components/list-pagination";
import {
  getRelationTypesPage,
  type RelationTypeSortDir,
  type RelationTypeSortField,
} from "@/lib/relation-types";

import { Button } from "@workspace/ui/components/button";
import { RelationTypeModal } from "./relation-type-modal";
import { RelationTypesSearch } from "./relation-types-search";
import { RelationTypesTable } from "./relation-types-table";

const DEFAULT_PAGE_SIZE = 15;

const SORT_FIELDS: RelationTypeSortField[] = ["name", "created"];
const SORT_DIRS: RelationTypeSortDir[] = ["asc", "desc"];

const parseSort = (
  sort?: string,
  dir?: string,
): { sortBy: RelationTypeSortField; sortDir: RelationTypeSortDir } => {
  const sortBy = SORT_FIELDS.includes(sort as RelationTypeSortField)
    ? (sort as RelationTypeSortField)
    : "name";
  const sortDir = SORT_DIRS.includes(dir as RelationTypeSortDir)
    ? (dir as RelationTypeSortDir)
    : "asc";
  return { sortBy, sortDir };
};

/**
 * Relation types list page. Fetches paginated rows and renders table with edit/delete row actions.
 */
const RelationTypesPage = async ({
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
    relationTypes,
    total,
    page: currentPage,
    pageSize: size,
  } = await getRelationTypesPage(page, pageSize, {
    search,
    sortBy,
    sortDir,
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Relation Types"
        description="Manage vocabulary used by the knowledge graph relation extractor."
      />
      <div className="flex flex-col justify-between sm:flex-row sm:items-center">
        <RelationTypesSearch
          initialQuery={search ?? ""}
          pageSize={size}
          sortBy={sortBy}
          sortDir={sortDir}
        />
        <div className="shrink-0 sm:ml-auto">
          <RelationTypeModal
            relationType={null}
            trigger={<Button>Add relation type</Button>}
          />
        </div>
      </div>
      <RelationTypesTable
        relationTypes={relationTypes}
        sortBy={sortBy}
        sortDir={sortDir}
        pageSize={size}
        searchQuery={search}
      />
      <ListPagination
        basePath="/dashboard/relation-types"
        page={currentPage}
        pageSize={size}
        total={total}
        ariaLabel="Relation types list pagination"
        searchQuery={search}
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </div>
  );
};

export default withAuthProtection(RelationTypesPage);
