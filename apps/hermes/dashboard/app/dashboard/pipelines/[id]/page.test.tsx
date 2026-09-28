import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { prismaDomainIntegrationFindManyMock } = vi.hoisted(() => ({
  prismaDomainIntegrationFindManyMock: vi
    .fn()
    .mockResolvedValue([
      { id: "di-1", integrationId: "mediapulse", name: "Mediapulse" },
    ]),
}));

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
const getAllAgentContractsMock = vi.fn();
vi.mock("@/lib/agent-configs", () => ({
  getAgentConfigsByAgentKeys: (...args: unknown[]) =>
    getAgentConfigsByAgentKeysMock(...args),
}));
vi.mock("@/lib/agent-contracts", () => ({
  getAllAgentContracts: (...args: unknown[]) =>
    getAllAgentContractsMock(...args),
}));
vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
  requireDashboardAdmin: async () => ({
    id: "u1",
    name: "U",
    email: "u@example.com",
    credentialVersion: 0,
  }),
}));

const getPipelineExecutionsPageMock = vi.fn().mockResolvedValue({
  executions: [],
  total: 0,
  page: 1,
  pageSize: 15,
});

vi.mock("@/lib/pipeline-executions", () => ({
  getPipelineExecutionsPage: (...args: unknown[]) =>
    getPipelineExecutionsPageMock(...args),
}));

vi.mock("./pipeline-executions-section", () => ({
  PipelineExecutionsSection: ({
    pipelineId,
    page,
    pageSize,
  }: {
    pipelineId: string;
    page: number;
    pageSize: number;
  }) => (
    <div
      data-testid="pipeline-executions-section"
      data-pipeline-id={pipelineId}
      data-page={page}
      data-page-size={pageSize}
    />
  ),
}));

vi.mock("@/lib/validate-pipeline", () => ({
  validatePipeline: vi.fn().mockResolvedValue({ valid: true, warnings: [] }),
}));

vi.mock("@hermes/orchestration-database", () => ({
  prisma: {
    domainIntegration: {
      findMany: prismaDomainIntegrationFindManyMock,
    },
  },
  DomainIntegrationStatus: { pending: "pending", active: "active" },
}));

vi.mock("./pipeline-detail-content", () => ({
  PipelineDetailContent: ({
    pipeline,
    agents,
    domainIntegrations,
    executionsSection,
  }: {
    pipeline: { id: string; name: string };
    agents: Array<{ id: string }>;
    domainIntegrations: Array<{ id: string }>;
    configsByAgentKey?: Record<string, unknown[]>;
    executionsSection: React.ReactNode;
  }) => (
    <div
      data-testid="pipeline-detail-content"
      data-pipeline-name={pipeline.name}
      data-agents-count={agents.length}
      data-domain-integrations-count={domainIntegrations.length}
    >
      Detail Content
      {executionsSection}
    </div>
  ),
}));

import PipelineDetailPage from "./page";

describe("PipelineDetailPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getPipelineWithStepsMock.mockReset();
    getAgentRegistryListMock.mockReset();
    getAgentConfigsByAgentKeysMock.mockReset();
    getAllAgentContractsMock.mockReset();
    getAllAgentContractsMock.mockResolvedValue([]);
    notFoundMock.mockReset();
    prismaDomainIntegrationFindManyMock.mockReset();
    prismaDomainIntegrationFindManyMock.mockResolvedValue([
      { id: "di-1", integrationId: "mediapulse", name: "Mediapulse" },
    ]);
  });

  it("renders pipeline detail content when authenticated", async () => {
    getAgentConfigsByAgentKeysMock.mockResolvedValue({});
    getAllAgentContractsMock.mockResolvedValue([]);
    // Setup
    getPipelineWithStepsMock.mockResolvedValue({
      id: "pipeline-123",
      domainIntegrationId: "di-1",
      name: "Test Pipeline",
      steps: [],
    });
    getAgentRegistryListMock.mockResolvedValue([
      { id: "agent-1", agentId: "summarizer", agentVersion: "1.0" },
    ]);

    // Act
    const component = await PipelineDetailPage({
      params: Promise.resolve({ id: "pipeline-123" }),
      searchParams: Promise.resolve({}),
    });
    render(component);

    // Assert
    expect(screen.getByTestId("pipeline-detail-content")).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-detail-content")).toHaveAttribute(
      "data-pipeline-name",
      "Test Pipeline",
    );
    expect(screen.getByTestId("pipeline-detail-content")).toHaveAttribute(
      "data-domain-integrations-count",
      "1",
    );
    expect(prismaDomainIntegrationFindManyMock).toHaveBeenCalledWith({
      orderBy: [{ isDefault: "desc" }, { integrationId: "asc" }],
      select: { id: true, integrationId: true, name: true },
    });
    expect(getAgentConfigsByAgentKeysMock).toHaveBeenCalledWith([
      { agentId: "summarizer", agentVersion: "1.0" },
    ]);
  });

  it("renders the executions section with pagination from searchParams", async () => {
    // Setup
    getAgentConfigsByAgentKeysMock.mockResolvedValue({});
    getPipelineWithStepsMock.mockResolvedValue({
      id: "pipeline-123",
      domainIntegrationId: "di-1",
      name: "Test Pipeline",
      steps: [],
    });
    getAgentRegistryListMock.mockResolvedValue([]);

    // Act
    const component = await PipelineDetailPage({
      params: Promise.resolve({ id: "pipeline-123" }),
      searchParams: Promise.resolve({ page: "2", size: "10" }),
    });
    render(component);

    // Assert
    const executionsSection = screen.getByTestId("pipeline-executions-section");

    expect(executionsSection).toHaveAttribute(
      "data-pipeline-id",
      "pipeline-123",
    );
    expect(executionsSection).toHaveAttribute("data-page", "2");
    expect(executionsSection).toHaveAttribute("data-page-size", "10");
    expect(getPipelineExecutionsPageMock).toHaveBeenCalledWith(
      "pipeline-123",
      2,
      10,
    );
  });

  it("passes agents to detail content", async () => {
    // Setup
    getAgentConfigsByAgentKeysMock.mockResolvedValue({});
    getAllAgentContractsMock.mockResolvedValue([]);
    getPipelineWithStepsMock.mockResolvedValue({
      id: "pipeline-123",
      domainIntegrationId: "di-1",
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
      searchParams: Promise.resolve({}),
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
    getAllAgentContractsMock.mockResolvedValue([]);
    getPipelineWithStepsMock.mockResolvedValue(null);
    getAgentRegistryListMock.mockResolvedValue([]);
    notFoundMock.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    // Act
    await expect(
      PipelineDetailPage({
        params: Promise.resolve({ id: "non-existent" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    // Assert
    expect(notFoundMock).toHaveBeenCalled();
    expect(getAgentRegistryListMock).not.toHaveBeenCalled();
  });
});
