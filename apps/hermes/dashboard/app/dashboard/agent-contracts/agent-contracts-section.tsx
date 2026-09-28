import {
  getAgentContractsPage,
  type AgentContractSortDir,
  type AgentContractSortField,
} from "@/lib/agent-contracts";
import { mergeColumnVisibility } from "@/lib/data-table/column-visibility";
import { readColumnVisibility } from "@/lib/data-table/read-column-visibility";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import { AgentContractsContent } from "./agent-contracts-content";
import {
  AGENT_CONTRACTS_DEFAULT_COLUMN_VISIBILITY,
  AGENT_CONTRACTS_TABLE_ID,
} from "./agent-contracts-table-defaults";

export type AgentContractsQuery = {
  page: number;
  pageSize: number;
  sortBy: AgentContractSortField;
  sortDir: AgentContractSortDir;
};

export const AgentContractsSection = async ({
  page,
  pageSize,
  sortBy,
  sortDir,
}: AgentContractsQuery) => {
  const [contractsResult, savedVisibility] = await Promise.all([
    withDashboardAdmin(
      getAgentContractsPage(page, pageSize, { sortBy, sortDir }),
    ),
    readColumnVisibility(AGENT_CONTRACTS_TABLE_ID),
  ]);

  return (
    <AgentContractsContent
      contracts={contractsResult.contracts}
      urlState={{
        basePath: "/dashboard/agent-contracts",
        page: contractsResult.page,
        pageSize: contractsResult.pageSize,
        total: contractsResult.total,
        sortBy,
        sortDir,
      }}
      initialColumnVisibility={mergeColumnVisibility(
        AGENT_CONTRACTS_DEFAULT_COLUMN_VISIBILITY,
        savedVisibility,
      )}
    />
  );
};
