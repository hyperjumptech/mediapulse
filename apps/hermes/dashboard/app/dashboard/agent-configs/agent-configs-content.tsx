"use client";

import type { VariableExpansionStringFieldLoaders } from "@workspace/variable-expansion-picker";

import { ListPagination } from "@/components/list-pagination";
import type {
  AgentConfigSortDir,
  AgentConfigSortField,
} from "@/lib/agent-configs";

import type { AgentConfigRow } from "./agent-config-row-actions";
import { AgentConfigsTable } from "./agent-configs-table";

type AgentForDropdown = {
  id: string;
  agentId: string;
  agentVersion: string;
};

type AgentConfigsContentProps = {
  configs: AgentConfigRow[];
  agents: AgentForDropdown[];
  total: number;
  page: number;
  pageSize: number;
  sortBy: AgentConfigSortField;
  sortDir: AgentConfigSortDir;
  pickerLoaders: VariableExpansionStringFieldLoaders;
};

export const AgentConfigsContent = ({
  configs,
  total,
  page,
  pageSize,
  sortBy,
  sortDir,
}: AgentConfigsContentProps) => {
  return (
    <div className="flex flex-col gap-4">
      <AgentConfigsTable
        configs={configs}
        sortBy={sortBy}
        sortDir={sortDir}
        pageSize={pageSize}
      />
      <ListPagination
        basePath="/dashboard/agent-configs"
        page={page}
        pageSize={pageSize}
        total={total}
        ariaLabel="Agent configs list pagination"
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </div>
  );
};
