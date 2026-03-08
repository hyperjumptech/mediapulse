"use client";

import { useState } from "react";

import type {
  AgentsPageResult,
  AgentSortDir,
  AgentSortField,
} from "@/lib/agents";

import { AgentDetailsModal } from "./agent-details-modal";
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
 * Client wrapper that holds view-modal state and renders the agents table plus details modal.
 * View row action opens the modal to show read-only agent details.
 */
export const AgentsTableWithEdit = ({
  agents,
  sortBy,
  sortDir,
  pageSize,
  searchQuery,
}: AgentsTableWithEditProps) => {
  const [viewingAgent, setViewingAgent] = useState<AgentRow | null>(null);

  return (
    <>
      <AgentsTable
        agents={agents}
        sortBy={sortBy}
        sortDir={sortDir}
        pageSize={pageSize}
        searchQuery={searchQuery}
        onView={setViewingAgent}
      />
      <AgentDetailsModal
        agent={viewingAgent}
        open={viewingAgent !== null}
        onOpenChange={(open) => !open && setViewingAgent(null)}
      />
    </>
  );
};
