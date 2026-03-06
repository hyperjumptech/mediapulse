"use client";

import { useState } from "react";

import type {
  AgentsPageResult,
  AgentSortDir,
  AgentSortField,
} from "@/lib/agents";

import { EditAgentModal } from "./edit-agent-modal";
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
 * Client wrapper that holds edit-modal state and renders the agents table plus edit modal.
 * Edit row action opens the modal instead of navigating to the edit page.
 */
export const AgentsTableWithEdit = ({
  agents,
  sortBy,
  sortDir,
  pageSize,
  searchQuery,
}: AgentsTableWithEditProps) => {
  const [editingAgent, setEditingAgent] = useState<AgentRow | null>(null);

  return (
    <>
      <AgentsTable
        agents={agents}
        sortBy={sortBy}
        sortDir={sortDir}
        pageSize={pageSize}
        searchQuery={searchQuery}
        onEdit={setEditingAgent}
      />
      <EditAgentModal
        agent={editingAgent}
        open={editingAgent !== null}
        onOpenChange={(open) => !open && setEditingAgent(null)}
      />
    </>
  );
};
