import {
  getAgentsPage,
  type AgentSortDir,
  type AgentSortField,
} from "@/lib/agents";
import { mergeColumnVisibility } from "@/lib/data-table/column-visibility";
import { readColumnVisibility } from "@/lib/data-table/read-column-visibility";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import {
  AGENTS_DEFAULT_COLUMN_VISIBILITY,
  AGENTS_TABLE_ID,
} from "./agents-table-defaults";
import { AgentsTable } from "./agents-table";

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
  const [agentsResult, savedVisibility] = await Promise.all([
    withDashboardAdmin(
      getAgentsPage(page, pageSize, { search, sortBy, sortDir }),
    ),
    readColumnVisibility(AGENTS_TABLE_ID),
  ]);

  return (
    <AgentsTable
      agents={agentsResult.agents}
      urlState={{
        basePath: "/dashboard/agents",
        page: agentsResult.page,
        pageSize: agentsResult.pageSize,
        total: agentsResult.total,
        search,
        sortBy,
        sortDir,
      }}
      initialColumnVisibility={mergeColumnVisibility(
        AGENTS_DEFAULT_COLUMN_VISIBILITY,
        savedVisibility,
      )}
    />
  );
};
