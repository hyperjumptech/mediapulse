import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import {
  getAgentsPage,
  type AgentSortDir,
  type AgentSortField,
} from "@/lib/agents";

import { ListPagination } from "@/components/list-pagination";
import { AgentsTableWithEdit } from "./agents-table-with-edit";
import { AgentsSearch } from "./agents-search";

const DEFAULT_PAGE_SIZE = 15;

const SORT_FIELDS: AgentSortField[] = ["agentId", "agentVersion", "created"];
const SORT_DIRS: AgentSortDir[] = ["asc", "desc"];

const parseSort = (
  sort?: string,
  dir?: string,
): { sortBy: AgentSortField; sortDir: AgentSortDir } => {
  const sortBy = SORT_FIELDS.includes(sort as AgentSortField)
    ? (sort as AgentSortField)
    : "agentId";
  const sortDir = SORT_DIRS.includes(dir as AgentSortDir)
    ? (dir as AgentSortDir)
    : "asc";
  return { sortBy, sortDir };
};

/**
 * Agents list page. Fetches paginated agents and renders table with edit/delete row actions.
 * Supports search by agent ID or description and sort by agentId, agentVersion, or created.
 */
const AgentsPage = async ({
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
    agents,
    total,
    page: currentPage,
    pageSize: size,
  } = await getAgentsPage(page, pageSize, { search, sortBy, sortDir });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Agents"
        description="View and manage registered agents."
      />
      <div className="flex flex-col justify-between sm:flex-row sm:items-center">
        <AgentsSearch
          initialQuery={search ?? ""}
          pageSize={size}
          sortBy={sortBy}
          sortDir={sortDir}
        />
      </div>
      <AgentsTableWithEdit
        agents={agents}
        sortBy={sortBy}
        sortDir={sortDir}
        pageSize={size}
        searchQuery={search}
      />
      <ListPagination
        basePath="/dashboard/agents"
        page={currentPage}
        pageSize={size}
        total={total}
        ariaLabel="Agents list pagination"
        searchQuery={search}
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </div>
  );
};

export default withAuthProtection(AgentsPage);
