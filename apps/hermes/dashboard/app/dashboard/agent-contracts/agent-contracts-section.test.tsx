import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getAgentContractsPageMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/agent-contracts", () => ({
  getAgentContractsPage: (...args: unknown[]) =>
    getAgentContractsPageMock(...args),
}));

vi.mock("@/lib/data-table/read-column-visibility", () => ({
  readColumnVisibility: async () => ({ description: false }),
}));

vi.mock("./agent-contracts-content", () => ({
  AgentContractsContent: ({
    contracts,
    urlState,
    initialColumnVisibility,
  }: {
    contracts: Array<{ id: string }>;
    urlState: {
      basePath: string;
      page: number;
      pageSize: number;
      total: number;
      sortBy: string;
      sortDir: string;
    };
    initialColumnVisibility: Record<string, boolean>;
  }) => (
    <div
      data-testid="agent-contracts-content"
      data-count={contracts.length}
      data-base-path={urlState.basePath}
      data-total={urlState.total}
      data-page={urlState.page}
      data-page-size={urlState.pageSize}
      data-sort-by={urlState.sortBy}
      data-sort-dir={urlState.sortDir}
      data-visibility={JSON.stringify(initialColumnVisibility)}
    />
  ),
}));

import { AgentContractsSection } from "./agent-contracts-section";

describe("AgentContractsSection", () => {
  afterEach(() => {
    getAgentContractsPageMock.mockReset();
  });

  it("hands the content its rows, URL state and saved column choices", async () => {
    // Setup
    getAgentContractsPageMock.mockResolvedValue({
      contracts: [{ id: "contract-1" }, { id: "contract-2" }],
      total: 32,
      page: 3,
      pageSize: 10,
    });

    // Act
    render(
      await AgentContractsSection({
        page: 3,
        pageSize: 10,
        sortBy: "createdAt",
        sortDir: "desc",
      }),
    );

    // Assert
    const content = screen.getByTestId("agent-contracts-content");

    expect(getAgentContractsPageMock).toHaveBeenCalledWith(3, 10, {
      sortBy: "createdAt",
      sortDir: "desc",
    });
    expect(content).toHaveAttribute("data-count", "2");
    expect(content).toHaveAttribute(
      "data-base-path",
      "/dashboard/agent-contracts",
    );
    expect(content).toHaveAttribute("data-total", "32");
    expect(content).toHaveAttribute("data-page", "3");
    expect(content).toHaveAttribute("data-page-size", "10");
    expect(content).toHaveAttribute("data-sort-by", "createdAt");
    expect(content).toHaveAttribute("data-sort-dir", "desc");
    expect(content).toHaveAttribute(
      "data-visibility",
      JSON.stringify({ createdBy: false, description: false }),
    );
  });
});
