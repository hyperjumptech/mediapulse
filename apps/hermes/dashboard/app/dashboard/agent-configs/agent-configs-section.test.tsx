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

vi.mock("@/lib/variable-expansion-picker-actions", () => ({
  loadExpansionPickerPage: vi.fn(),
  loadVariablePickerPage: vi.fn(),
}));

vi.mock("./agent-configs-content", () => ({
  AgentConfigsContent: ({
    configs,
    agents,
    total,
    page,
    pageSize,
    sortBy,
    sortDir,
  }: {
    configs: Array<{ id: string; schemaValid: boolean }>;
    agents: Array<{ id: string }>;
    total: number;
    page: number;
    pageSize: number;
    sortBy: string;
    sortDir: string;
  }) => {
    const schemaValidById = Object.fromEntries(
      configs.map((config) => [config.id, config.schemaValid]),
    );

    return (
      <div
        data-testid="agent-configs-content"
        data-schema-valid={JSON.stringify(schemaValidById)}
        data-agents-count={agents.length}
        data-total={total}
        data-page={page}
        data-page-size={pageSize}
        data-sort-by={sortBy}
        data-sort-dir={sortDir}
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

const mockAgentRegistry = ({
  dropdownAgents,
  registeredSchemas,
}: {
  dropdownAgents: Array<{ id: string; agentId: string; agentVersion: string }>;
  registeredSchemas: Array<{
    agentId: string;
    agentVersion: string;
    configSchema: Record<string, unknown> | null;
  }>;
}) => {
  findManyAgentRegistry.mockImplementation(
    async (args: { select: Record<string, boolean> }) =>
      args.select.configSchema ? registeredSchemas : dropdownAgents,
  );
};

const renderedContent = () => screen.getByTestId("agent-configs-content");

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
    mockAgentRegistry({
      dropdownAgents: [],
      registeredSchemas: [
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
      ],
    });

    // Act
    render(await AgentConfigsSection(baseQuery));

    // Assert
    const schemaValidById = JSON.parse(
      renderedContent().getAttribute("data-schema-valid") ?? "{}",
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
    mockAgentRegistry({ dropdownAgents: [], registeredSchemas: [] });

    // Act
    render(await AgentConfigsSection(baseQuery));

    // Assert
    expect(findManyAgentRegistry).toHaveBeenCalledTimes(1);
  });

  it("forwards sort and pagination and renders the agent dropdown options", async () => {
    // Setup
    getAgentConfigsPageMock.mockResolvedValue({
      configs: [],
      total: 21,
      page: 2,
      pageSize: 20,
    });
    mockAgentRegistry({
      dropdownAgents: [
        { id: "agent-1", agentId: "summarizer", agentVersion: "1.0.0" },
        { id: "agent-2", agentId: "classifier", agentVersion: "2.0.0" },
      ],
      registeredSchemas: [],
    });

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
    const content = renderedContent();

    expect(getAgentConfigsPageMock).toHaveBeenCalledWith(2, 20, {
      sortBy: "agentId",
      sortDir: "desc",
    });
    expect(content).toHaveAttribute("data-agents-count", "2");
    expect(content).toHaveAttribute("data-total", "21");
    expect(content).toHaveAttribute("data-page", "2");
    expect(content).toHaveAttribute("data-page-size", "20");
    expect(content).toHaveAttribute("data-sort-by", "agentId");
    expect(content).toHaveAttribute("data-sort-dir", "desc");
  });
});
