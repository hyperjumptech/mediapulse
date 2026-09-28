"use client";

import { useCallback, useState } from "react";

import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import type { ListUrlState } from "@/lib/data-table/list-url-state";

import type { AgentContractRow } from "./agent-contract-row-actions";
import { AgentContractsTable } from "./agent-contracts-table";
import { EditContractModal } from "./edit-contract-modal";

type AgentContractsContentProps = {
  contracts: AgentContractRow[];
  urlState: ListUrlState;
  initialColumnVisibility?: ColumnVisibility;
};

const useEditingContract = () => {
  const [editingContract, setEditingContract] =
    useState<AgentContractRow | null>(null);

  const handleEditOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setEditingContract(null);
    }
  }, []);

  return { editingContract, setEditingContract, handleEditOpenChange };
};

export const AgentContractsContent = ({
  contracts,
  urlState,
  initialColumnVisibility,
}: AgentContractsContentProps) => {
  const { editingContract, setEditingContract, handleEditOpenChange } =
    useEditingContract();

  return (
    <>
      <AgentContractsTable
        contracts={contracts}
        urlState={urlState}
        onEdit={setEditingContract}
        initialColumnVisibility={initialColumnVisibility}
      />
      <EditContractModal
        contract={editingContract}
        open={editingContract !== null}
        onOpenChange={handleEditOpenChange}
      />
    </>
  );
};
