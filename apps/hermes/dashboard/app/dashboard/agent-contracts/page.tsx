import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import {
  getAgentContractsPage,
  type AgentContractSortDir,
  type AgentContractSortField,
} from "@/lib/agent-contracts";

import { AgentContractsContent } from "./agent-contracts-content";

const DEFAULT_PAGE_SIZE = 15;

const SORT_FIELDS: AgentContractSortField[] = ["name", "createdAt"];
const SORT_DIRS: AgentContractSortDir[] = ["asc", "desc"];

const parseSort = (
  sort?: string,
  dir?: string,
): { sortBy: AgentContractSortField; sortDir: AgentContractSortDir } => {
  const sortBy = SORT_FIELDS.includes(sort as AgentContractSortField)
    ? (sort as AgentContractSortField)
    : "name";
  const sortDir = SORT_DIRS.includes(dir as AgentContractSortDir)
    ? (dir as AgentContractSortDir)
    : "asc";
  return { sortBy, sortDir };
};

const AgentContractsPage = async ({
  searchParams,
}: {
  searchParams:
    | Promise<{ page?: string; size?: string; sort?: string; dir?: string }>
    | { page?: string; size?: string; sort?: string; dir?: string };
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
  const { sortBy, sortDir } = parseSort(resolved.sort, resolved.dir);

  const {
    contracts,
    total,
    page: currentPage,
    pageSize: size,
  } = await getAgentContractsPage(page, pageSize, { sortBy, sortDir });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Agent contracts"
        description="Create reusable product briefs that guide agents toward the intended end result."
      />
      <AgentContractsContent
        contracts={contracts}
        total={total}
        page={currentPage}
        pageSize={size}
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </div>
  );
};

export default withAuthProtection(AgentContractsPage);
