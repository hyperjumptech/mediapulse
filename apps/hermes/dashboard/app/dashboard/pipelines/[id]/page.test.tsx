import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getPipelineWithStepsMock = vi.fn();
const getAgentRegistryListMock = vi.fn();
const notFoundMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: () => notFoundMock(),
}));

vi.mock("@/lib/pipelines", () => ({
  getPipelineWithSteps: (...args: unknown[]) =>
    getPipelineWithStepsMock(...args),
  getAgentRegistryList: () => getAgentRegistryListMock(),
}));

const getAgentConfigsByAgentKeysMock = vi.fn();
vi.mock("@/lib/agent-configs", () => ({
  getAgentConfigsByAgentKeys: (...args: unknown[]) =>
    getAgentConfigsByAgentKeysMock(...args),
}));

vi.mock("@/lib/validate-pipeline", () => ({
  validatePipeline: vi.fn().mockResolvedValue({ valid: true, warnings: [] }),
}));

vi.mock("@/lib/variables", () => ({
  getVariablesPage: vi.fn().mockResolvedValue({
    variables: [],
    total: 0,
    page: 1,
    pageSize: 500,
  }),
}));

vi.mock("@/lib/domain-integrations", () => ({
  getDefaultDomainIntegration: vi.fn().mockResolvedValue({
    key: "mediapulse",
    id: "i1",
    name: "Mediapulse",
    baseUrl: "http://localhost",
    version: "1",
    capabilities: ["expand-step-inputs", "preview-expansion"],
    dashboard: { templateVersion: 1, pages: [] },
  }),
}));

vi.mock("@/lib/data-source-expansions", () => ({
  getDataSourceExpansionsPage: vi.fn().mockResolvedValue({
    expansions: [],
    total: 0,
    page: 1,
    pageSize: 500,
  }),
}));

vi.mock("@hermes/orchestration-database", () => ({
  prisma: {},
}));

vi.mock("./pipeline-detail-content", () => ({
  PipelineDetailContent: ({
    pipeline,
    agents,
  }: {
    pipeline: { id: string; name: string };
    agents: Array<{ id: string }>;
    configsByAgentKey?: Record<string, unknown[]>;
  }) => (
    <div
      data-testid="pipeline-detail-content"
      data-pipeline-name={pipeline.name}
      data-agents-count={agents.length}
    >
      Detail Content
    </div>
  ),
}));

vi.mock("@/components/with-auth-protection", () => ({
  withAuthProtection: <P extends Record<string, unknown>>(
    Component: (props: P) => React.ReactNode,
  ) => Component,
}));

import PipelineDetailPage from "./page";

describe("PipelineDetailPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getPipelineWithStepsMock.mockReset();
    getAgentRegistryListMock.mockReset();
    getAgentConfigsByAgentKeysMock.mockReset();
    notFoundMock.mockReset();
  });

  it("renders pipeline detail content when authenticated", async () => {
    getAgentConfigsByAgentKeysMock.mockResolvedValue({});
    // Setup
    getPipelineWithStepsMock.mockResolvedValue({
      id: "pipeline-123",
      name: "Test Pipeline",
      steps: [],
    });
    getAgentRegistryListMock.mockResolvedValue([
      { id: "agent-1", agentId: "summarizer", agentVersion: "1.0" },
    ]);

    // Act
    const component = await PipelineDetailPage({
      params: Promise.resolve({ id: "pipeline-123" }),
    });
    render(component);

    // Assert
    expect(screen.getByTestId("pipeline-detail-content")).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-detail-content")).toHaveAttribute(
      "data-pipeline-name",
      "Test Pipeline",
    );
  });

  it("passes agents to detail content", async () => {
    // Setup
    getAgentConfigsByAgentKeysMock.mockResolvedValue({});
    getPipelineWithStepsMock.mockResolvedValue({
      id: "pipeline-123",
      name: "Test Pipeline",
      steps: [],
    });
    getAgentRegistryListMock.mockResolvedValue([
      { id: "agent-1" },
      { id: "agent-2" },
    ]);

    // Act
    const component = await PipelineDetailPage({
      params: Promise.resolve({ id: "pipeline-123" }),
    });
    render(component);

    // Assert
    expect(screen.getByTestId("pipeline-detail-content")).toHaveAttribute(
      "data-agents-count",
      "2",
    );
  });

  it("calls notFound when pipeline does not exist", async () => {
    // Setup
    getAgentConfigsByAgentKeysMock.mockResolvedValue({});
    getPipelineWithStepsMock.mockResolvedValue(null);
    getAgentRegistryListMock.mockResolvedValue([]);

    // Act
    await PipelineDetailPage({
      params: Promise.resolve({ id: "non-existent" }),
    });

    // Assert
    expect(notFoundMock).toHaveBeenCalled();
  });
});
