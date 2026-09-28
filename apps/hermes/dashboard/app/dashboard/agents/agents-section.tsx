import { ListPagination } from "@/components/list-pagination";
import {
  getAgentsPage,
  type AgentSortDir,
  type AgentSortField,
} from "@/lib/agents";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import { AgentsSearch } from "./agents-search";
import { AgentsTableWithEdit } from "./agents-table-with-edit";

export type AgentsQuery = {
  page: number;
  pageSize: number;
  search: string | undefined;
  sortBy: AgentSortField;
  sortDir: AgentSortDir;
};

export const AgentsSection = async ({
  page,
  pageSize,
  search,
  sortBy,
  sortDir,
}: AgentsQuery) => {
  const agentsResult = await withDashboardAdmin(
    getAgentsPage(page, pageSize, { search, sortBy, sortDir }),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AgentsSearch
          initialQuery={search ?? ""}
          pageSize={agentsResult.pageSize}
          sortBy={sortBy}
          sortDir={sortDir}
        />
      </div>
      <AgentsTableWithEdit
        agents={agentsResult.agents}
        sortBy={sortBy}
        sortDir={sortDir}
        pageSize={agentsResult.pageSize}
        searchQuery={search}
      />
      <ListPagination
        basePath="/dashboard/agents"
        page={agentsResult.page}
        pageSize={agentsResult.pageSize}
        total={agentsResult.total}
        ariaLabel="Agents list pagination"
        searchQuery={search}
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </div>
  );
};
