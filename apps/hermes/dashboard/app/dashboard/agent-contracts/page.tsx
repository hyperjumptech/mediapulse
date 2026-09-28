import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { ListBodySkeleton } from "@/components/page-skeletons";
import type { AgentContractSortField } from "@/lib/agent-contracts";
import {
  parseListPagination,
  parseListSort,
  type ListPageSearchParams,
} from "@/lib/list-page-params";

import {
  AgentContractsSection,
  type AgentContractsQuery,
} from "./agent-contracts-section";

const SORT_FIELDS: AgentContractSortField[] = ["name", "createdAt"];

const AgentContractsPage = async ({
  searchParams,
}: {
  searchParams: Promise<ListPageSearchParams> | ListPageSearchParams;
}) => {
  const resolved = await Promise.resolve(searchParams);
  const query: AgentContractsQuery = {
    ...parseListPagination(resolved),
    ...parseListSort(resolved, SORT_FIELDS, "name"),
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Agent contracts"
        description="Create reusable product briefs that guide agents toward the intended end result."
      />
      <Suspense key={JSON.stringify(query)} fallback={<ListBodySkeleton />}>
        <AgentContractsSection {...query} />
      </Suspense>
    </div>
  );
};

export default AgentContractsPage;
