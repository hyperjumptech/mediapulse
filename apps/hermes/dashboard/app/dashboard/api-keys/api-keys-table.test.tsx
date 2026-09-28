import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { McpApiKeyListRow } from "@/lib/mcp-api-keys";

vi.mock("./api-key-row-actions", () => ({
  ApiKeyRowActions: ({ row }: { row: { id: string; label: string } }) => (
    <div data-testid={`api-key-row-actions-${row.id}`} data-label={row.label} />
  ),
}));

import { ApiKeysTable } from "./api-keys-table";

const createApiKey = (
  overrides?: Partial<McpApiKeyListRow>,
): McpApiKeyListRow => ({
  id: "key-1",
  label: "Cursor",
  readOnly: true,
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
  lastUsedAt: null,
  createdByUserId: "user-1",
  createdBy: { id: "user-1", name: "Ada", email: "ada@example.com" },
  ...overrides,
});

const apiKeys = [
  createApiKey(),
  createApiKey({
    id: "key-2",
    label: "CI",
    readOnly: false,
    createdAt: new Date("2026-01-03T00:00:00.000Z"),
    lastUsedAt: new Date("2026-01-04T00:00:00.000Z"),
    createdByUserId: "user-2",
    createdBy: null,
  }),
];

const table = () => screen.getByRole("table");

const bodyRows = () => within(table()).getAllByRole("row").slice(1);

describe("ApiKeysTable", () => {
  it("shows label, access, dates, creator and actions columns", () => {
    render(<ApiKeysTable apiKeys={apiKeys} />);

    const headers = within(table())
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual([
      "Label",
      "Access",
      "Created",
      "Last used",
      "Created by",
      "Actions",
    ]);
    expect(
      within(table()).getByRole("columnheader", { name: "Created by" }),
    ).toHaveClass("hidden", "lg:table-cell");
  });

  it("renders each key with its access level and creator", () => {
    render(<ApiKeysTable apiKeys={apiKeys} />);

    const [cursorRow, ciRow] = bodyRows() as [HTMLElement, HTMLElement];

    expect(cursorRow).toHaveTextContent("Cursor");
    expect(within(cursorRow).getByText("Read-only")).toHaveAttribute(
      "data-variant",
      "muted",
    );
    expect(cursorRow).toHaveTextContent("Ada");
    expect(cursorRow).toHaveTextContent("Never");
    expect(within(ciRow).getByText("Full")).toHaveAttribute(
      "data-variant",
      "outline",
    );
    expect(ciRow).toHaveTextContent("user-2");
  });

  it("shows the created date and when the key was last used", () => {
    render(<ApiKeysTable apiKeys={apiKeys} />);

    const ciRow = bodyRows()[1] as HTMLElement;
    const lastUsedTime = ciRow.querySelector(
      'time[datetime="2026-01-04T00:00:00.000Z"]',
    );

    expect(within(ciRow).getByText("Jan 3, 2026")).toBeInTheDocument();
    expect(lastUsedTime).toHaveTextContent("Jan 4, 00:00");
  });

  it("passes the key id and label to the row actions", () => {
    render(<ApiKeysTable apiKeys={apiKeys} />);

    expect(
      within(table()).getByTestId("api-key-row-actions-key-2"),
    ).toHaveAttribute("data-label", "CI");
  });

  it("starts from the saved column visibility", () => {
    render(
      <ApiKeysTable
        apiKeys={apiKeys}
        initialColumnVisibility={{ createdBy: false }}
      />,
    );

    expect(
      within(table()).queryByRole("columnheader", { name: "Created by" }),
    ).not.toBeInTheDocument();
  });

  it("renders the empty state when there are no keys", () => {
    render(<ApiKeysTable apiKeys={[]} />);

    expect(screen.getByText("No API keys yet")).toBeInTheDocument();
    expect(screen.getByText("Create one for MCP access.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
