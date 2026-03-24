import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineDetailContent } from "./pipeline-detail-content";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock(
  "@/app/dashboard/pipelines/actions/update/.generated/form.action",
  () => ({ formAction: vi.fn().mockResolvedValue({ status: true }) }),
);
vi.mock(
  "@/app/dashboard/pipelines/actions/update-step/.generated/form.action",
  () => ({ formAction: vi.fn().mockResolvedValue({ status: true }) }),
);

vi.mock("./pipeline-available-agents", () => ({
  PipelineAvailableAgents: ({
    pipelineId,
    existingStepAgentKeys,
  }: {
    pipelineId: string;
    existingStepAgentKeys: string[];
  }) => (
    <div
      data-testid="pipeline-available-agents"
      data-pipeline-id={pipelineId}
      data-existing-count={existingStepAgentKeys.length}
    />
  ),
}));

vi.mock("./pipeline-steps-column", () => ({
  PipelineStepsColumn: ({
    pipelineId,
    steps,
  }: {
    pipelineId: string;
    steps: Array<{ id: string }>;
  }) => (
    <div
      data-testid="pipeline-steps-column"
      data-pipeline-id={pipelineId}
      data-steps-count={steps.length}
    />
  ),
}));

vi.mock("./pipeline-step-editor-panel", () => ({
  PipelineStepEditorPanel: ({
    selectedStep,
  }: {
    selectedStep: { id: string } | null;
  }) => (
    <div
      data-testid="pipeline-step-editor-panel"
      data-selected-step-id={selectedStep?.id ?? "none"}
    />
  ),
}));

vi.mock("./run-pipeline-button", () => ({
  RunPipelineButton: ({ pipelineId }: { pipelineId: string }) => (
    <button data-testid="run-pipeline-button" data-pipeline-id={pipelineId}>
      Run
    </button>
  ),
}));
vi.mock("./pipeline-executions-table", () => ({
  PipelineExecutionsTable: () => (
    <div data-testid="pipeline-executions-table" />
  ),
}));

const createMockPipelineValidation = () => ({
  valid: true,
  warnings: [] as string[],
});

const createMockPipeline = () => ({
  id: "pipeline-123",
  domainIntegrationId: "di-1",
  name: "Test Pipeline",
  description: "Test description",
  isActive: true,
  executionConfig: null,
  steps: [
    {
      id: "step-1",
      pipelineId: "pipeline-123",
      order: 0,
      agentId: "summarizer",
      agentVersion: "1.0",
      input: {},
      config: {},
      agentConfigId: null,
      createdAt: new Date("2024-01-15"),
      updatedAt: new Date("2024-01-15"),
    },
  ],
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
});

const createMockAgents = () => [
  {
    id: "agent-1",
    domainIntegrationId: "di-1",
    agentId: "summarizer",
    agentVersion: "1.0",
    description: "Summarizes text",
    isActive: true,
    endpoint: {},
    inputSchema: null,
    configSchema: null,
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
  },
];

const mockPickerLoaders = {
  loadVariablePickerPage: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  loadExpansionPickerPage: vi.fn().mockResolvedValue({ items: [], total: 0 }),
};

describe("PipelineDetailContent", () => {
  it("renders pipeline name and description inputs above the columns", () => {
    render(
      <PipelineDetailContent
        pipeline={createMockPipeline()}
        agents={createMockAgents()}
        configsByAgentKey={{}}
        pipelineValidation={createMockPipelineValidation()}
        executions={[]}
        totalExecutions={0}
        currentPage={1}
        pageSize={15}
        {...mockPickerLoaders}
      />,
    );

    expect(screen.getByLabelText("Pipeline name")).toBeInTheDocument();
    expect(screen.getByLabelText("Pipeline name")).toHaveValue("Test Pipeline");
    expect(screen.getByLabelText("Description (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Description (optional)")).toHaveValue(
      "Test description",
    );
  });

  it("renders Save button beside Run pipeline button", () => {
    render(
      <PipelineDetailContent
        pipeline={createMockPipeline()}
        agents={createMockAgents()}
        configsByAgentKey={{}}
        pipelineValidation={createMockPipelineValidation()}
        executions={[]}
        totalExecutions={0}
        currentPage={1}
        pageSize={15}
        {...mockPickerLoaders}
      />,
    );

    expect(screen.getByTestId("run-pipeline-button")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("renders three columns: available agents, steps, editor panel", () => {
    render(
      <PipelineDetailContent
        pipeline={createMockPipeline()}
        agents={createMockAgents()}
        configsByAgentKey={{}}
        pipelineValidation={createMockPipelineValidation()}
        executions={[]}
        totalExecutions={0}
        currentPage={1}
        pageSize={15}
        {...mockPickerLoaders}
      />,
    );

    expect(screen.getByTestId("pipeline-available-agents")).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-steps-column")).toBeInTheDocument();
    expect(
      screen.getByTestId("pipeline-step-editor-panel"),
    ).toBeInTheDocument();
  });

  it("renders steps column with step count", () => {
    render(
      <PipelineDetailContent
        pipeline={createMockPipeline()}
        agents={createMockAgents()}
        configsByAgentKey={{}}
        pipelineValidation={createMockPipelineValidation()}
        executions={[]}
        totalExecutions={0}
        currentPage={1}
        pageSize={15}
        {...mockPickerLoaders}
      />,
    );

    expect(screen.getByTestId("pipeline-steps-column")).toHaveAttribute(
      "data-steps-count",
      "1",
    );
  });

  it("renders description placeholder when none provided", () => {
    const pipeline = {
      ...createMockPipeline(),
      description: null,
    };

    render(
      <PipelineDetailContent
        pipeline={pipeline}
        agents={createMockAgents()}
        configsByAgentKey={{}}
        pipelineValidation={createMockPipelineValidation()}
        executions={[]}
        totalExecutions={0}
        currentPage={1}
        pageSize={15}
        {...mockPickerLoaders}
      />,
    );

    const descInput = screen.getByLabelText("Description (optional)");
    expect(descInput).toHaveAttribute(
      "placeholder",
      "Edit pipeline and manage agent steps.",
    );
  });
});
