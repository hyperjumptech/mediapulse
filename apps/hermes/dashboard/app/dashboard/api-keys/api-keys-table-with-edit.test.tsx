import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiKeysTableWithEdit } from "./api-keys-table-with-edit";

vi.mock("./api-keys-table", () => ({
  ApiKeysTable: ({
    apiKeys,
    onEdit,
    sortBy,
    sortDir,
    pageSize,
    searchQuery,
  }: {
    apiKeys: Array<{ id: string; name: string }>;
    onEdit?: (apiKey: { id: string; name: string }) => void;
    sortBy: string;
    sortDir: string;
    pageSize: number;
    searchQuery?: string;
  }) => (
    <div
      data-testid="api-keys-table"
      data-count={apiKeys.length}
      data-sort-by={sortBy}
      data-sort-dir={sortDir}
      data-page-size={pageSize}
      data-search={searchQuery}
    >
      {apiKeys.map((apiKey) => (
        <button
          key={apiKey.id}
          data-testid={`edit-${apiKey.id}`}
          onClick={() => onEdit?.(apiKey)}
        >
          Edit {apiKey.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("./edit-api-key-modal", () => ({
  EditApiKeyModal: ({
    apiKey,
    open,
    onOpenChange,
  }: {
    apiKey: { id: string; name: string } | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div
      data-testid="edit-api-key-modal"
      data-api-key-id={apiKey?.id ?? "none"}
      data-open={open}
    >
      <button data-testid="close-modal" onClick={() => onOpenChange(false)}>
        Close
      </button>
    </div>
  ),
}));

const createMockApiKey = (id: string, name: string) => ({
  id,
  name,
  key: "hash",
  purpose: null as string | null,
  isActive: true,
  userId: "user-1",
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
  user: { id: "user-1", name: "Admin", email: "admin@example.com" },
});

describe("ApiKeysTableWithEdit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders table with apiKeys and edit modal", () => {
    const apiKeys = [
      createMockApiKey("key-1", "Key A"),
      createMockApiKey("key-2", "Key B"),
    ];

    render(
      <ApiKeysTableWithEdit
        apiKeys={apiKeys}
        sortBy="name"
        sortDir="asc"
        pageSize={15}
      />,
    );

    expect(screen.getByTestId("api-keys-table")).toHaveAttribute(
      "data-count",
      "2",
    );
    expect(screen.getByTestId("edit-api-key-modal")).toHaveAttribute(
      "data-open",
      "false",
    );
  });

  it("opens edit modal when Edit is clicked", () => {
    const apiKeys = [createMockApiKey("key-1", "Production key")];

    render(
      <ApiKeysTableWithEdit
        apiKeys={apiKeys}
        sortBy="name"
        sortDir="asc"
        pageSize={15}
      />,
    );

    fireEvent.click(screen.getByTestId("edit-key-1"));

    expect(screen.getByTestId("edit-api-key-modal")).toHaveAttribute(
      "data-open",
      "true",
    );
    expect(screen.getByTestId("edit-api-key-modal")).toHaveAttribute(
      "data-api-key-id",
      "key-1",
    );
  });

  it("closes edit modal when Close is clicked", () => {
    const apiKeys = [createMockApiKey("key-1", "Key A")];

    render(
      <ApiKeysTableWithEdit
        apiKeys={apiKeys}
        sortBy="name"
        sortDir="asc"
        pageSize={15}
      />,
    );

    fireEvent.click(screen.getByTestId("edit-key-1"));
    expect(screen.getByTestId("edit-api-key-modal")).toHaveAttribute(
      "data-open",
      "true",
    );

    fireEvent.click(screen.getByTestId("close-modal"));
    expect(screen.getByTestId("edit-api-key-modal")).toHaveAttribute(
      "data-open",
      "false",
    );
  });
});
