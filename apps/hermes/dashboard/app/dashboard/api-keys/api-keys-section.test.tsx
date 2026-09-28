import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const listActiveMcpApiKeysMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/mcp-api-keys", () => ({
  listActiveMcpApiKeys: () => listActiveMcpApiKeysMock(),
}));

vi.mock("./api-key-row-actions", () => ({
  ApiKeyRowActions: ({ row }: { row: { id: string; label: string } }) => (
    <div data-testid={`api-key-row-actions-${row.id}`} data-label={row.label} />
  ),
}));

import { ApiKeysSection } from "./api-keys-section";

describe("ApiKeysSection", () => {
  afterEach(() => {
    listActiveMcpApiKeysMock.mockReset();
  });

  it("renders each key with its access level and creator", async () => {
    // Setup
    listActiveMcpApiKeysMock.mockResolvedValue([
      {
        id: "key-1",
        label: "Cursor",
        readOnly: true,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        lastUsedAt: null,
        createdByUserId: "user-1",
        createdBy: { id: "user-1", name: "Ada", email: "ada@example.com" },
      },
      {
        id: "key-2",
        label: "CI",
        readOnly: false,
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
        lastUsedAt: new Date("2026-01-04T00:00:00.000Z"),
        createdByUserId: null,
        createdBy: null,
      },
    ]);

    // Act
    const { container } = render(await ApiKeysSection());

    // Assert
    const lastUsedTime = container.querySelector("time");

    expect(screen.getByText("Cursor")).toBeInTheDocument();
    expect(screen.getByText("Read-only")).toHaveAttribute(
      "data-variant",
      "muted",
    );
    expect(screen.getByText("Full")).toHaveAttribute("data-variant", "outline");
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(lastUsedTime).toHaveAttribute(
      "datetime",
      "2026-01-04T00:00:00.000Z",
    );
    expect(screen.getByTestId("api-key-row-actions-key-2")).toHaveAttribute(
      "data-label",
      "CI",
    );
  });

  it("renders the empty state when there are no keys", async () => {
    // Setup
    listActiveMcpApiKeysMock.mockResolvedValue([]);

    // Act
    render(await ApiKeysSection());

    // Assert
    expect(screen.getByText("No API keys yet")).toBeInTheDocument();
    expect(screen.getByText("Create one for MCP access.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
