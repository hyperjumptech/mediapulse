"use client";

import { useState } from "react";

import type {
  ApiKeysPageResult,
  ApiKeySortDir,
  ApiKeySortField,
} from "@/lib/api-keys";

import { EditApiKeyModal } from "./edit-api-key-modal";
import { ApiKeysTable } from "./api-keys-table";

type ApiKeyRow = ApiKeysPageResult["apiKeys"][number];

type ApiKeysTableWithEditProps = {
  apiKeys: ApiKeyRow[];
  sortBy: ApiKeySortField;
  sortDir: ApiKeySortDir;
  pageSize: number;
  searchQuery?: string;
};

/**
 * Encapsulates API keys table edit modal state.
 */
const useApiKeysTableWithEditState = () => {
  const [editingApiKey, setEditingApiKey] = useState<ApiKeyRow | null>(null);
  return {
    editingApiKey,
    setEditingApiKey,
  };
};

/**
 * Client wrapper that holds edit-modal state and renders the API keys table plus edit modal.
 * Edit row action opens the modal.
 */
export const ApiKeysTableWithEdit = ({
  apiKeys,
  sortBy,
  sortDir,
  pageSize,
  searchQuery,
}: ApiKeysTableWithEditProps) => {
  const { editingApiKey, setEditingApiKey } = useApiKeysTableWithEditState();

  return (
    <>
      <ApiKeysTable
        apiKeys={apiKeys}
        sortBy={sortBy}
        sortDir={sortDir}
        pageSize={pageSize}
        searchQuery={searchQuery}
        onEdit={setEditingApiKey}
      />
      <EditApiKeyModal
        apiKey={editingApiKey}
        open={editingApiKey !== null}
        onOpenChange={(open) => !open && setEditingApiKey(null)}
      />
    </>
  );
};
