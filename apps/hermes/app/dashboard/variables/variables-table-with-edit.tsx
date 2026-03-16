"use client";

import { useState } from "react";

import type {
  VariablesPageResult,
  VariableSortDir,
  VariableSortField,
} from "@/lib/variables";

import { VariableModal } from "./variable-modal";
import { VariablesTable } from "./variables-table";

type VariableRow = VariablesPageResult["variables"][number];

type VariablesTableWithEditProps = {
  variables: VariableRow[];
  sortBy: VariableSortField;
  sortDir: VariableSortDir;
  pageSize: number;
  searchQuery?: string;
};

/**
 * Encapsulates variables table edit modal state.
 */
const useVariablesTableWithEditState = () => {
  const [editingVariable, setEditingVariable] = useState<VariableRow | null>(
    null,
  );
  return {
    editingVariable,
    setEditingVariable,
  };
};

/**
 * Client wrapper that holds edit-modal state and renders the variables table plus edit modal.
 * Edit row action opens the modal.
 */
export const VariablesTableWithEdit = ({
  variables,
  sortBy,
  sortDir,
  pageSize,
  searchQuery,
}: VariablesTableWithEditProps) => {
  const { editingVariable, setEditingVariable } =
    useVariablesTableWithEditState();

  return (
    <>
      <VariablesTable
        variables={variables}
        sortBy={sortBy}
        sortDir={sortDir}
        pageSize={pageSize}
        searchQuery={searchQuery}
        onEdit={setEditingVariable}
      />
      <VariableModal
        variable={editingVariable}
        open={editingVariable !== null}
        onOpenChange={(open) => !open && setEditingVariable(null)}
      />
    </>
  );
};
