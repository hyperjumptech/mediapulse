"use client";

import Link from "next/link";

import { Button } from "@workspace/ui/components/button";

import { ListPagination } from "@/components/list-pagination";
import { AgentConfigsTable } from "./agent-configs-table";
import type { AgentConfigRow } from "./agent-config-row-actions";
import type {
  AgentConfigSortDir,
  AgentConfigSortField,
} from "@/lib/agent-configs";
import type { VariableExpansionStringFieldLoaders } from "@workspace/variable-expansion-picker";

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

/**
 * Client wrapper for agent configs list: table and pagination.
 */
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
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/dashboard/agent-configs/new">Add config</Link>
        </Button>
      </div>
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
