"use client";

import { useCallback, useState } from "react";

import { ListPagination } from "@/components/list-pagination";
import type {
  AgentContractSortDir,
  AgentContractSortField,
} from "@/lib/agent-contracts";

import type { AgentContractRow } from "./agent-contract-row-actions";
import { AgentContractsTable } from "./agent-contracts-table";
import { EditContractModal } from "./edit-contract-modal";

type AgentContractsContentProps = {
  contracts: AgentContractRow[];
  total: number;
  page: number;
  pageSize: number;
  sortBy: AgentContractSortField;
  sortDir: AgentContractSortDir;
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
  total,
  page,
  pageSize,
  sortBy,
  sortDir,
}: AgentContractsContentProps) => {
  const { editingContract, setEditingContract, handleEditOpenChange } =
    useEditingContract();

  return (
    <>
      <div className="flex flex-col gap-4">
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
      <EditContractModal
        contract={editingContract}
        open={editingContract !== null}
        onOpenChange={handleEditOpenChange}
      />
    </>
  );
};
