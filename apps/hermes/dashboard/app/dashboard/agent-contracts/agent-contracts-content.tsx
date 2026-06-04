"use client";

import { useCallback, useState } from "react";

import { Button } from "@workspace/ui/components/button";

import { ListPagination } from "@/components/list-pagination";
import { AddContractModal } from "./add-contract-modal";
import { AgentContractsTable } from "./agent-contracts-table";
import { EditContractModal } from "./edit-contract-modal";
import type { AgentContractRow } from "./agent-contract-row-actions";
import type {
  AgentContractSortDir,
  AgentContractSortField,
} from "@/lib/agent-contracts";

type AgentContractsContentProps = {
  contracts: AgentContractRow[];
  total: number;
  page: number;
  pageSize: number;
  sortBy: AgentContractSortField;
  sortDir: AgentContractSortDir;
};

const useAgentContractsModals = () => {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingContract, setEditingContract] =
    useState<AgentContractRow | null>(null);

  const openAddModal = useCallback(() => setAddModalOpen(true), []);
  const setEditingContractOrClose = useCallback(
    (contract: AgentContractRow | null) => {
      setEditingContract(contract);
    },
    [],
  );

  return {
    addModalOpen,
    setAddModalOpen,
    editingContract,
    openAddModal,
    setEditingContract: setEditingContractOrClose,
  };
};

export const AgentContractsContent = ({
  contracts,
  total,
  page,
  pageSize,
  sortBy,
  sortDir,
}: AgentContractsContentProps) => {
  const {
    addModalOpen,
    setAddModalOpen,
    editingContract,
    openAddModal,
    setEditingContract,
  } = useAgentContractsModals();

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button onClick={openAddModal}>Add contract</Button>
        </div>
        <AgentContractsTable
          contracts={contracts}
          sortBy={sortBy}
          sortDir={sortDir}
          pageSize={pageSize}
          onEdit={setEditingContract}
        />
        <ListPagination
          basePath="/dashboard/agent-contracts"
          page={page}
          pageSize={pageSize}
          total={total}
          ariaLabel="Agent contracts list pagination"
          sortBy={sortBy}
          sortDir={sortDir}
        />
      </div>
      <AddContractModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        trigger={null}
      />
      <EditContractModal
        contract={editingContract}
        open={editingContract !== null}
        onOpenChange={(open) => !open && setEditingContract(null)}
      />
    </>
  );
};
