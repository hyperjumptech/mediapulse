import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getPipelineSummariesPageMock = vi.fn();

const { findManyDomainIntegrations } = vi.hoisted(() => ({
  findManyDomainIntegrations: vi.fn(),
}));

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/pipeline-summaries", () => ({
  getPipelineSummariesPage: (...args: unknown[]) =>
    getPipelineSummariesPageMock(...args),
}));

vi.mock("@hermes/orchestration-database", () => ({
  prisma: {
    domainIntegration: {
      findMany: findManyDomainIntegrations,
    },
  },
}));

vi.mock("@/lib/data-table/read-column-visibility", () => ({
  readColumnVisibility: async () => ({ description: false }),
}));

vi.mock("./pipelines-with-modal", () => ({
  PipelinesWithModal: ({
    pipelines,
    urlState,
    initialColumnVisibility,
    domainIntegrations,
  }: {
    pipelines: Array<{ id: string }>;
    urlState: Record<string, unknown>;
    initialColumnVisibility: Record<string, boolean>;
    domainIntegrations: unknown[];
  }) => (
    <div
      data-testid="pipelines-with-modal"
      data-count={pipelines.length}
      data-url-state={JSON.stringify(urlState)}
      data-visibility={JSON.stringify(initialColumnVisibility)}
      data-domain-count={domainIntegrations.length}
    />
  ),
}));

import { PipelinesSection } from "./pipelines-section";

const baseQuery = {
  page: 1,
  pageSize: 15,
  search: undefined,
  sortBy: "updated" as const,
  sortDir: "desc" as const,
};

describe("PipelinesSection", () => {
  afterEach(() => {
    getPipelineSummariesPageMock.mockReset();
    findManyDomainIntegrations.mockReset();
  });

  it("hands the table its rows, URL state, saved column choices and domain integrations", async () => {
    getPipelineSummariesPageMock.mockResolvedValue({
      pipelines: [{ id: "p1" }],
      total: 31,
      page: 2,
      pageSize: 15,
    });
    findManyDomainIntegrations.mockResolvedValue([
      { id: "integration-1", integrationId: "primary", name: "Primary" },
    ]);

    render(
      await PipelinesSection({
        ...baseQuery,
        page: 2,
        search: "digest",
        sortBy: "name",
        sortDir: "asc",
      }),
    );

    const table = screen.getByTestId("pipelines-with-modal");
    const urlState = JSON.parse(table.getAttribute("data-url-state") ?? "{}");

    expect(getPipelineSummariesPageMock).toHaveBeenCalledWith({
      page: 2,
      pageSize: 15,
      search: "digest",
      sortBy: "name",
      sortDir: "asc",
    });
    expect(urlState).toEqual({
      basePath: "/dashboard/pipelines",
      page: 2,
      pageSize: 15,
      total: 31,
      search: "digest",
      sortBy: "name",
      sortDir: "asc",
    });
    expect(table).toHaveAttribute("data-count", "1");
    expect(table).toHaveAttribute(
      "data-visibility",
      JSON.stringify({ createdBy: false, description: false }),
    );
    expect(table).toHaveAttribute("data-domain-count", "1");
    expect(findManyDomainIntegrations).toHaveBeenCalledWith({
      orderBy: [{ isDefault: "desc" }, { integrationId: "asc" }],
      select: { id: true, integrationId: true, name: true },
    });
  });

  it("renders an empty page", async () => {
    getPipelineSummariesPageMock.mockResolvedValue({
      pipelines: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });
    findManyDomainIntegrations.mockResolvedValue([]);

    render(await PipelinesSection(baseQuery));

    const table = screen.getByTestId("pipelines-with-modal");

    expect(table).toHaveAttribute("data-count", "0");
    expect(table).toHaveAttribute("data-domain-count", "0");
  });
});
