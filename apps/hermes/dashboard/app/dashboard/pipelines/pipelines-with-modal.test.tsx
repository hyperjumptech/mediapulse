import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelinesWithModal } from "./pipelines-with-modal";

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    onClick,
  }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

vi.mock("./pipeline-form-modal", () => ({
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

vi.mock("./pipelines-table", () => ({
  PipelinesTable: ({
    pipelines,
    onEdit,
  }: {
    pipelines: Array<{ id: string }>;
    onEdit?: (id: string) => void;
  }) => (
    <div data-testid="pipelines-table" data-count={pipelines.length}>
      {pipelines.map((p) => (
        <button
          key={p.id}
          data-testid={`edit-${p.id}`}
          onClick={() => onEdit?.(p.id)}
        >
          Edit {p.id}
        </button>
      ))}
    </div>
  ),
}));

const createMockPipeline = (id: string, name: string) => ({
  id,
  domainIntegrationId: "di-1",
  name,
  description: null,
  isActive: true,
  executionConfig: null,
  createdById: null,
  createdBy: null,
  steps: [],
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
});

describe("PipelinesWithModal", () => {
  it("renders create pipeline button", () => {
    // Act
    render(<PipelinesWithModal pipelines={[]} pipelineValidationById={{}} />);

    // Assert
    expect(
      screen.getByRole("button", { name: "Create pipeline" }),
    ).toBeInTheDocument();
  });

  it("renders pipelines table", () => {
    // Setup
    const pipelines = [createMockPipeline("1", "Pipeline A")];

    // Act
    render(
      <PipelinesWithModal
        pipelines={pipelines}
        pipelineValidationById={{ "1": { valid: true, warnings: [] } }}
      />,
    );

    // Assert
    expect(screen.getByTestId("pipelines-table")).toBeInTheDocument();
    expect(screen.getByTestId("pipelines-table")).toHaveAttribute(
      "data-count",
      "1",
    );
  });

  it("renders pipeline form modal", () => {
    // Act
    render(<PipelinesWithModal pipelines={[]} pipelineValidationById={{}} />);

    // Assert
    expect(screen.getByTestId("pipeline-form-modal")).toBeInTheDocument();
  });

  it("opens create modal when clicking create button", () => {
    // Act
    render(<PipelinesWithModal pipelines={[]} pipelineValidationById={{}} />);

    fireEvent.click(screen.getByRole("button", { name: "Create pipeline" }));

    // Assert
    expect(screen.getByTestId("pipeline-form-modal")).toHaveAttribute(
      "data-open",
      "true",
    );
    expect(screen.getByTestId("pipeline-form-modal")).toHaveAttribute(
      "data-mode",
      "create",
    );
  });

  it("opens edit modal when clicking edit in table", () => {
    // Setup
    const pipelines = [createMockPipeline("pipeline-1", "Pipeline A")];

    // Act
    render(
      <PipelinesWithModal
        pipelines={pipelines}
        pipelineValidationById={{
          "pipeline-1": { valid: true, warnings: [] },
        }}
      />,
    );

    fireEvent.click(screen.getByTestId("edit-pipeline-1"));

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
      "pipeline-1",
    );
  });

  it("modal is closed initially", () => {
    // Act
    render(<PipelinesWithModal pipelines={[]} pipelineValidationById={{}} />);

    // Assert
    expect(screen.getByTestId("pipeline-form-modal")).toHaveAttribute(
      "data-open",
      "false",
    );
  });
});
