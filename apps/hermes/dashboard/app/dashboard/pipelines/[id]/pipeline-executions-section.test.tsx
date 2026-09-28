import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getPipelineExecutionsPageMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
  requireDashboardAdmin: async () => ({
    id: "u1",
    name: "U",
    email: "u@example.com",
    credentialVersion: 0,
  }),
}));

vi.mock("@/lib/pipeline-executions", () => ({
  getPipelineExecutionsPage: (...args: unknown[]) =>
    getPipelineExecutionsPageMock(...args),
}));

vi.mock("./pipeline-executions-table", () => ({
  PipelineExecutionsTable: ({
    pipelineId,
    executions,
  }: {
    pipelineId: string;
    executions: unknown[];
  }) => (
    <div
      data-testid="pipeline-executions-table"
      data-pipeline-id={pipelineId}
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

import { PipelineExecutionsSection } from "./pipeline-executions-section";

describe("PipelineExecutionsSection", () => {
  afterEach(() => {
    getPipelineExecutionsPageMock.mockReset();
  });

  it("renders the executions table and pagination from the loader", async () => {
    // Setup
    getPipelineExecutionsPageMock.mockResolvedValue({
      executions: [{ id: "execution-1" }, { id: "execution-2" }],
      total: 12,
      page: 2,
      pageSize: 10,
    });

    // Act
    render(
      await PipelineExecutionsSection({
        pipelineId: "pipeline-123",
        page: 2,
        pageSize: 10,
      }),
    );

    // Assert
    const table = screen.getByTestId("pipeline-executions-table");
    const pagination = screen.getByTestId("executions-pagination");

    expect(getPipelineExecutionsPageMock).toHaveBeenCalledWith(
      "pipeline-123",
      2,
      10,
    );
    expect(table).toHaveAttribute("data-pipeline-id", "pipeline-123");
    expect(table).toHaveAttribute("data-count", "2");
    expect(pagination).toHaveAttribute(
      "data-base-path",
      "/dashboard/pipelines/pipeline-123",
    );
    expect(pagination).toHaveAttribute("data-page", "2");
    expect(pagination).toHaveAttribute("data-page-size", "10");
    expect(pagination).toHaveAttribute("data-total", "12");
  });
});
