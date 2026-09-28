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

vi.mock("./agent-contracts-content", () => ({
  AgentContractsContent: ({
    contracts,
    total,
    page,
    pageSize,
    sortBy,
    sortDir,
  }: {
    contracts: Array<{ id: string }>;
    total: number;
    page: number;
    pageSize: number;
    sortBy: string;
    sortDir: string;
  }) => (
    <div
      data-testid="agent-contracts-content"
      data-count={contracts.length}
      data-total={total}
      data-page={page}
      data-page-size={pageSize}
      data-sort-by={sortBy}
      data-sort-dir={sortDir}
    />
  ),
}));

import { AgentContractsSection } from "./agent-contracts-section";

describe("AgentContractsSection", () => {
  afterEach(() => {
    getAgentContractsPageMock.mockReset();
  });

  it("renders contracts and pagination from the loader", async () => {
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
    expect(content).toHaveAttribute("data-total", "32");
    expect(content).toHaveAttribute("data-page", "3");
    expect(content).toHaveAttribute("data-page-size", "10");
    expect(content).toHaveAttribute("data-sort-by", "createdAt");
    expect(content).toHaveAttribute("data-sort-dir", "desc");
  });
});
