import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { configSchemaFingerprint } from "@/lib/config-schema-fingerprint";

const getAgentConfigsPageMock = vi.fn();

const { findManyAgentRegistry } = vi.hoisted(() => ({
  findManyAgentRegistry: vi.fn(),
}));

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/agent-configs", () => ({
  getAgentConfigsPage: (...args: unknown[]) => getAgentConfigsPageMock(...args),
}));

vi.mock("@hermes/orchestration-database", () => ({
  prisma: {
    agentRegistry: {
      findMany: findManyAgentRegistry,
    },
  },
}));

vi.mock("@/lib/data-table/read-column-visibility", () => ({
  readColumnVisibility: async () => ({ description: false }),
}));

vi.mock("./agent-configs-table", () => ({
  AgentConfigsTable: ({
    configs,
    urlState,
    initialColumnVisibility,
  }: {
    configs: Array<{ id: string; schemaValid: boolean }>;
    urlState: {
      basePath: string;
      page: number;
      pageSize: number;
      total: number;
      sortBy: string;
      sortDir: string;
    };
    initialColumnVisibility: Record<string, boolean>;
  }) => {
    const schemaValidById = Object.fromEntries(
      configs.map((config) => [config.id, config.schemaValid]),
    );

    return (
      <div
        data-testid="agent-configs-table"
        data-schema-valid={JSON.stringify(schemaValidById)}
        data-base-path={urlState.basePath}
        data-total={urlState.total}
        data-page={urlState.page}
        data-page-size={urlState.pageSize}
        data-sort-by={urlState.sortBy}
        data-sort-dir={urlState.sortDir}
        data-visibility={JSON.stringify(initialColumnVisibility)}
      />
    );
  },
}));

import { AgentConfigsSection } from "./agent-configs-section";

const baseQuery = {
  page: 1,
  pageSize: 15,
  sortBy: "name" as const,
  sortDir: "asc" as const,
};

const buildConfig = (
  id: string,
  agentId: string,
  configSchemaFingerprint: string | null,
) => ({
  id,
  name: id,
  description: null,
  agentId,
  agentVersion: "1.0.0",
  config: {},
  configSchemaFingerprint,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  createdBy: null,
});

const mockRegisteredSchemas = (
  registeredSchemas: Array<{
    agentId: string;
    agentVersion: string;
    configSchema: Record<string, unknown> | null;
  }>,
) => {
  findManyAgentRegistry.mockResolvedValue(registeredSchemas);
};

const renderedTable = () => screen.getByTestId("agent-configs-table");

describe("AgentConfigsSection", () => {
  afterEach(() => {
    getAgentConfigsPageMock.mockReset();
    findManyAgentRegistry.mockReset();
  });

  it("marks configs whose agent schema changed since they were saved", async () => {
    // Setup
    const currentSchema = { type: "object", properties: { tone: {} } };
    const currentFingerprint = configSchemaFingerprint(currentSchema);
    getAgentConfigsPageMock.mockResolvedValue({
      configs: [
        buildConfig("matching", "summarizer", currentFingerprint),
        buildConfig("stale", "summarizer", "outdated-fingerprint"),
        buildConfig("unversioned", "classifier", null),
        buildConfig("schemaless", "translator", "any-fingerprint"),
      ],
      total: 4,
      page: 1,
      pageSize: 15,
    });
    mockRegisteredSchemas([
      {
        agentId: "summarizer",
        agentVersion: "1.0.0",
        configSchema: currentSchema,
      },
      {
        agentId: "classifier",
        agentVersion: "1.0.0",
        configSchema: currentSchema,
      },
      { agentId: "translator", agentVersion: "1.0.0", configSchema: null },
    ]);

    // Act
    render(await AgentConfigsSection(baseQuery));

    // Assert
    const schemaValidById = JSON.parse(
      renderedTable().getAttribute("data-schema-valid") ?? "{}",
    );

    expect(schemaValidById).toEqual({
      matching: true,
      stale: false,
      unversioned: true,
      schemaless: true,
    });
    expect(findManyAgentRegistry).toHaveBeenCalledWith({
      where: {
        OR: [
          { agentId: "summarizer", agentVersion: "1.0.0" },
          { agentId: "classifier", agentVersion: "1.0.0" },
          { agentId: "translator", agentVersion: "1.0.0" },
        ],
        isActive: true,
      },
      select: { agentId: true, agentVersion: true, configSchema: true },
    });
  });

  it("skips the schema lookup when the page has no configs", async () => {
    // Setup
    getAgentConfigsPageMock.mockResolvedValue({
      configs: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });
    mockRegisteredSchemas([]);

    // Act
    render(await AgentConfigsSection(baseQuery));

    // Assert
    expect(findManyAgentRegistry).not.toHaveBeenCalled();
  });

  it("hands the table its URL state and saved column choices", async () => {
    // Setup
    getAgentConfigsPageMock.mockResolvedValue({
      configs: [],
      total: 21,
      page: 2,
      pageSize: 20,
    });
    mockRegisteredSchemas([]);

    // Act
    render(
      await AgentConfigsSection({
        page: 2,
        pageSize: 20,
        sortBy: "agentId",
        sortDir: "desc",
      }),
    );

    // Assert
    const table = renderedTable();

    expect(getAgentConfigsPageMock).toHaveBeenCalledWith(2, 20, {
      sortBy: "agentId",
      sortDir: "desc",
    });
    expect(table).toHaveAttribute("data-base-path", "/dashboard/agent-configs");
    expect(table).toHaveAttribute("data-total", "21");
    expect(table).toHaveAttribute("data-page", "2");
    expect(table).toHaveAttribute("data-page-size", "20");
    expect(table).toHaveAttribute("data-sort-by", "agentId");
    expect(table).toHaveAttribute("data-sort-dir", "desc");
    expect(table).toHaveAttribute(
      "data-visibility",
      JSON.stringify({ createdBy: false, description: false }),
    );
  });
});
