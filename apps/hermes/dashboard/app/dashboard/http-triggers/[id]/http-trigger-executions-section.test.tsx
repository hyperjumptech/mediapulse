import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getHttpTriggerExecutionsPageMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
  requireDashboardAdmin: async () => ({
    id: "u1",
    name: "U",
    email: "u@example.com",
    credentialVersion: 0,
  }),
}));

vi.mock("@/lib/http-triggers", () => ({
  getHttpTriggerExecutionsPage: (...args: unknown[]) =>
    getHttpTriggerExecutionsPageMock(...args),
}));

vi.mock("./executions-table", () => ({
  ExecutionsTable: ({
    triggerId,
    executions,
  }: {
    triggerId: string;
    executions: unknown[];
  }) => (
    <div
      data-testid="executions-table"
      data-trigger-id={triggerId}
      data-count={executions.length}
    />
  ),
}));

vi.mock("@/components/list-pagination", () => ({
  ListPagination: ({
    basePath,
    page,
    pageSize,
    total,
  }: {
    basePath: string;
    page: number;
    pageSize: number;
    total: number;
  }) => (
    <nav
      data-testid="executions-pagination"
      data-base-path={basePath}
      data-page={page}
      data-page-size={pageSize}
      data-total={total}
    />
  ),
}));

import { HttpTriggerExecutionsSection } from "./http-trigger-executions-section";

describe("HttpTriggerExecutionsSection", () => {
  afterEach(() => {
    getHttpTriggerExecutionsPageMock.mockReset();
  });

  it("renders the executions table and pagination from the loader", async () => {
    // Setup
    getHttpTriggerExecutionsPageMock.mockResolvedValue({
      executions: [{ id: "execution-1" }, { id: "execution-2" }],
      total: 22,
      page: 3,
      pageSize: 10,
    });

    // Act
    render(
      await HttpTriggerExecutionsSection({
        triggerId: "trigger-1",
        page: 3,
        pageSize: 10,
      }),
    );

    // Assert
    const table = screen.getByTestId("executions-table");
    const pagination = screen.getByTestId("executions-pagination");

    expect(getHttpTriggerExecutionsPageMock).toHaveBeenCalledWith(
      "trigger-1",
      3,
      10,
    );
    expect(table).toHaveAttribute("data-trigger-id", "trigger-1");
    expect(table).toHaveAttribute("data-count", "2");
    expect(pagination).toHaveAttribute(
      "data-base-path",
      "/dashboard/http-triggers/trigger-1",
    );
    expect(pagination).toHaveAttribute("data-page", "3");
    expect(pagination).toHaveAttribute("data-page-size", "10");
    expect(pagination).toHaveAttribute("data-total", "22");
  });
});
