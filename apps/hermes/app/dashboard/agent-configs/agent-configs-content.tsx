"use client";

import { useCallback, useState } from "react";

import { Button } from "@workspace/ui/components/button";

import { AddConfigModal } from "./add-config-modal";
import { AgentConfigsTable } from "./agent-configs-table";
import { EditConfigModal } from "./edit-config-modal";
import { AgentConfigsPagination } from "./pagination";
import type { AgentConfigRow } from "./agent-config-row-actions";
import type {
  AgentConfigSortDir,
  AgentConfigSortField,
} from "@/lib/agent-configs";

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
};

/**
 * Modal open state and edit/duplicate selection for the agent configs page.
 */
const useAgentConfigsModals = () => {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [duplicateConfig, setDuplicateConfig] = useState<AgentConfigRow | null>(
    null,
  );
  const [editingConfig, setEditingConfig] = useState<AgentConfigRow | null>(
    null,
  );

  const openAddModal = useCallback(() => setAddModalOpen(true), []);
  const openDuplicateModal = useCallback((config: AgentConfigRow) => {
    setDuplicateConfig(config);
    setAddModalOpen(true);
  }, []);
  const handleAddModalOpenChange = useCallback((open: boolean) => {
    setAddModalOpen(open);
    if (!open) setDuplicateConfig(null);
  }, []);
  const setEditingConfigOrClose = useCallback(
    (config: AgentConfigRow | null) => {
      setEditingConfig(config);
    },
    [],
  );

  return {
    addModalOpen,
    duplicateConfig,
    editingConfig,
    openAddModal,
    openDuplicateModal,
    handleAddModalOpenChange,
    setEditingConfig: setEditingConfigOrClose,
  };
};

/**
 * Client wrapper for agent configs list: table, add/edit/duplicate modals, pagination.
 */
export const AgentConfigsContent = ({
  configs,
  agents,
  total,
  page,
  pageSize,
  sortBy,
  sortDir,
}: AgentConfigsContentProps) => {
  const {
    addModalOpen,
    duplicateConfig,
    editingConfig,
    openAddModal,
    openDuplicateModal,
    handleAddModalOpenChange,
    setEditingConfig,
  } = useAgentConfigsModals();

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col justify-between sm:flex-row sm:items-center">
          <h1 className="text-lg font-semibold">Agent configs</h1>
          <div className="shrink-0 sm:ml-auto">
            <Button onClick={openAddModal}>Add config</Button>
          </div>
        </div>
        <AgentConfigsTable
          configs={configs}
          sortBy={sortBy}
          sortDir={sortDir}
          pageSize={pageSize}
          onEdit={setEditingConfig}
          onDuplicate={openDuplicateModal}
        />
        <AgentConfigsPagination
          basePath="/dashboard/agent-configs"
          page={page}
          pageSize={pageSize}
          total={total}
          sortBy={sortBy}
          sortDir={sortDir}
        />
      </div>
      <AddConfigModal
        agents={agents}
        open={addModalOpen}
        onOpenChange={handleAddModalOpenChange}
        initialData={duplicateConfig}
        trigger={null}
      />
      <EditConfigModal
        config={editingConfig}
        agents={agents}
        open={editingConfig !== null}
        onOpenChange={(open) => !open && setEditingConfig(null)}
      />
    </>
  );
};
