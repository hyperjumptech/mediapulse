import { Suspense } from "react";

import { ListBodySkeleton } from "@/components/page-skeletons";
import type { AgentSortField } from "@/lib/agents";
import {
  parseListPagination,
  parseListSearch,
  parseListSort,
  type ListPageSearchParams,
} from "@/lib/list-page-params";

import { AgentsSection, type AgentsQuery } from "./agents-section";

const SORT_FIELDS: AgentSortField[] = [
  "agentId",
  "agentVersion",
  "created",
  "updated",
];

const AgentsPage = async ({
  searchParams,
}: {
  searchParams: Promise<ListPageSearchParams> | ListPageSearchParams;
}) => {
  const resolved = await Promise.resolve(searchParams);
  const query: AgentsQuery = {
    ...parseListPagination(resolved),
    ...parseListSort(resolved, SORT_FIELDS, "agentId"),
    search: parseListSearch(resolved),
  };

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<ListBodySkeleton />}>
        <AgentsSection {...query} />
      </Suspense>
    </div>
  );
};

export default AgentsPage;
