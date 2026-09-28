import {
  getAgentContractsPage,
  type AgentContractSortDir,
  type AgentContractSortField,
} from "@/lib/agent-contracts";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import { AgentContractsContent } from "./agent-contracts-content";

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
  const contractsResult = await withDashboardAdmin(
    getAgentContractsPage(page, pageSize, { sortBy, sortDir }),
  );

  return (
    <AgentContractsContent
      contracts={contractsResult.contracts}
      total={contractsResult.total}
      page={contractsResult.page}
      pageSize={contractsResult.pageSize}
      sortBy={sortBy}
      sortDir={sortDir}
    />
  );
};
