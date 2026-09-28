import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { ListBodySkeleton } from "@/components/page-skeletons";
import type { AgentConfigSortField } from "@/lib/agent-configs";
import {
  parseListPagination,
  parseListSort,
  type ListPageSearchParams,
} from "@/lib/list-page-params";

import {
  AgentConfigsSection,
  type AgentConfigsQuery,
} from "./agent-configs-section";

const SORT_FIELDS: AgentConfigSortField[] = ["name", "createdAt", "agentId"];

const AgentConfigsPage = async ({
  searchParams,
}: {
  searchParams: Promise<ListPageSearchParams> | ListPageSearchParams;
}) => {
  const resolved = await Promise.resolve(searchParams);
  const query: AgentConfigsQuery = {
    ...parseListPagination(resolved),
    ...parseListSort(resolved, SORT_FIELDS, "name"),
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Agent configs"
        description="Create and manage agent configuration presets."
      />
      <Suspense key={JSON.stringify(query)} fallback={<ListBodySkeleton />}>
        <AgentConfigsSection {...query} />
      </Suspense>
    </div>
  );
};

export default AgentConfigsPage;
