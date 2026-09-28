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

vi.mock("@/lib/data-table/read-column-visibility", () => ({
  readColumnVisibility: async () => ({ createdBy: false }),
}));

vi.mock("./api-keys-table", () => ({
  ApiKeysTable: ({
    apiKeys,
    initialColumnVisibility,
  }: {
    apiKeys: Array<{ id: string }>;
    initialColumnVisibility: Record<string, boolean>;
  }) => (
    <div
      data-testid="api-keys-table"
      data-ids={apiKeys.map((apiKey) => apiKey.id).join(",")}
      data-visibility={JSON.stringify(initialColumnVisibility)}
    />
  ),
}));

import { ApiKeysSection } from "./api-keys-section";

describe("ApiKeysSection", () => {
  afterEach(() => {
    listActiveMcpApiKeysMock.mockReset();
  });

  it("hands the table the active keys and saved column choices", async () => {
    listActiveMcpApiKeysMock.mockResolvedValue([
      { id: "key-1", label: "Cursor" },
      { id: "key-2", label: "CI" },
    ]);

    render(await ApiKeysSection());

    const table = screen.getByTestId("api-keys-table");

    expect(table).toHaveAttribute("data-ids", "key-1,key-2");
    expect(table).toHaveAttribute(
      "data-visibility",
      JSON.stringify({ createdBy: false }),
    );
  });

  it("hands the table an empty list when there are no keys", async () => {
    listActiveMcpApiKeysMock.mockResolvedValue([]);

    render(await ApiKeysSection());

    expect(screen.getByTestId("api-keys-table")).toHaveAttribute(
      "data-ids",
      "",
    );
  });
});
