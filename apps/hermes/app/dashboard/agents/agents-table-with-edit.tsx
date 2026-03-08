"use client";

import type {
  AgentsPageResult,
  AgentSortDir,
  AgentSortField,
} from "@/lib/agents";

import { AgentsTable } from "./agents-table";

type AgentRow = AgentsPageResult["agents"][number];

type AgentsTableWithEditProps = {
  agents: AgentRow[];
  sortBy: AgentSortField;
  sortDir: AgentSortDir;
  pageSize: number;
  searchQuery?: string;
};

/**
 * Client wrapper that renders the agents table. View row action and agent ID link navigate to the agent detail page.
 */
export const AgentsTableWithEdit = ({
  agents,
  sortBy,
  sortDir,
  pageSize,
  searchQuery,
}: AgentsTableWithEditProps) => {
  return (
    <AgentsTable
      agents={agents}
      sortBy={sortBy}
      sortDir={sortDir}
      pageSize={pageSize}
      searchQuery={searchQuery}
    />
  );
};
