import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineDetailContent } from "./pipeline-detail-content";

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    onClick,
    variant,
  }: React.PropsWithChildren<{ onClick?: () => void; variant?: string }>) => (
    <button onClick={onClick} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock("../pipeline-form-modal", () => ({
  PipelineFormModal: ({
    open,
    mode,
    editPipelineId,
  }: {
    open: boolean;
    mode: string;
    editPipelineId: string | null;
  }) => (
    <div
      data-testid="pipeline-form-modal"
      data-open={open}
      data-mode={mode}
      data-edit-id={editPipelineId ?? "none"}
    />
  ),
}));

vi.mock("./add-step-form", () => ({
  AddStepForm: ({ pipelineId }: { pipelineId: string }) => (
    <div data-testid="add-step-form" data-pipeline-id={pipelineId} />
  ),
}));

vi.mock("./run-pipeline-button", () => ({
  RunPipelineButton: ({ pipelineId }: { pipelineId: string }) => (
    <button data-testid="run-pipeline-button" data-pipeline-id={pipelineId}>
      Run
    </button>
  ),
}));

vi.mock("./step-list", () => ({
  StepList: ({
    pipelineId,
    steps,
  }: {
    pipelineId: string;
    steps: Array<{ id: string }>;
  }) => (
    <div
      data-testid="step-list"
      data-pipeline-id={pipelineId}
      data-steps-count={steps.length}
    />
  ),
}));

const createMockPipeline = () => ({
  id: "pipeline-123",
  name: "Test Pipeline",
  description: "Test description",
  isActive: true,
  steps: [
    { id: "step-1", order: 0, agentId: "summarizer", agentVersion: "1.0" },
  ],
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
});

const createMockAgents = () => [
  {
    id: "agent-1",
    agentId: "summarizer",
    agentVersion: "1.0",
    description: "Summarizes text",
  },
];

describe("PipelineDetailContent", () => {
  it("renders pipeline name as heading", () => {
    // Act
    render(
      <PipelineDetailContent
        pipeline={createMockPipeline()}
        agents={createMockAgents()}
      />,
    );

    // Assert
    expect(
      screen.getByRole("heading", { name: "Test Pipeline", level: 1 }),
    ).toBeInTheDocument();
  });

  it("renders pipeline description", () => {
    // Act
    render(
      <PipelineDetailContent
        pipeline={createMockPipeline()}
        agents={createMockAgents()}
      />,
    );

    // Assert
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  it("renders Edit details button", () => {
    // Act
    render(
      <PipelineDetailContent
        pipeline={createMockPipeline()}
        agents={createMockAgents()}
      />,
    );

    // Assert
    expect(
      screen.getByRole("button", { name: "Edit details" }),
    ).toBeInTheDocument();
  });

  it("renders run pipeline button", () => {
    // Act
    render(
      <PipelineDetailContent
        pipeline={createMockPipeline()}
        agents={createMockAgents()}
      />,
    );

    // Assert
    expect(screen.getByTestId("run-pipeline-button")).toBeInTheDocument();
  });

  it("renders step list", () => {
    // Act
    render(
      <PipelineDetailContent
        pipeline={createMockPipeline()}
        agents={createMockAgents()}
      />,
    );

    // Assert
    expect(screen.getByTestId("step-list")).toBeInTheDocument();
    expect(screen.getByTestId("step-list")).toHaveAttribute(
      "data-steps-count",
      "1",
    );
  });

  it("renders add step form", () => {
    // Act
    render(
      <PipelineDetailContent
        pipeline={createMockPipeline()}
        agents={createMockAgents()}
      />,
    );

    // Assert
    expect(screen.getByTestId("add-step-form")).toBeInTheDocument();
  });

  it("opens edit modal when clicking Edit details", () => {
    // Act
    render(
      <PipelineDetailContent
        pipeline={createMockPipeline()}
        agents={createMockAgents()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit details" }));

    // Assert
    expect(screen.getByTestId("pipeline-form-modal")).toHaveAttribute(
      "data-open",
      "true",
    );
    expect(screen.getByTestId("pipeline-form-modal")).toHaveAttribute(
      "data-mode",
      "edit",
    );
    expect(screen.getByTestId("pipeline-form-modal")).toHaveAttribute(
      "data-edit-id",
      "pipeline-123",
    );
  });

  it("renders default description when none provided", () => {
    // Setup
    const pipeline = {
      ...createMockPipeline(),
      description: null,
    };

    // Act
    render(
      <PipelineDetailContent pipeline={pipeline} agents={createMockAgents()} />,
    );

    // Assert
    expect(
      screen.getByText("Edit pipeline and manage agent steps."),
    ).toBeInTheDocument();
  });
});
