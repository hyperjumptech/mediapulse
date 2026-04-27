import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelinesTable } from "./pipelines-table";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@workspace/ui/components/badge", () => ({
  Badge: ({
    children,
    variant,
  }: React.PropsWithChildren<{ variant?: string }>) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

vi.mock("@workspace/ui/components/table", () => ({
  Table: ({ children }: React.PropsWithChildren) => (
    <table data-testid="table">{children}</table>
  ),
  TableHeader: ({ children }: React.PropsWithChildren) => (
    <thead>{children}</thead>
  ),
  TableBody: ({ children }: React.PropsWithChildren) => (
    <tbody>{children}</tbody>
  ),
  TableRow: ({ children }: React.PropsWithChildren) => <tr>{children}</tr>,
  TableHead: ({ children }: React.PropsWithChildren) => <th>{children}</th>,
  TableCell: ({
    children,
    colSpan,
  }: React.PropsWithChildren<{ colSpan?: number }>) => (
    <td colSpan={colSpan}>{children}</td>
  ),
}));

vi.mock("./pipeline-row-actions", () => ({
  PipelineRowActions: ({
    pipelineId,
    pipelineName,
  }: {
    pipelineId: string;
    pipelineName: string;
  }) => (
    <button data-testid={`row-actions-${pipelineId}`} data-name={pipelineName}>
      Actions
    </button>
  ),
}));

const createMockPipeline = (
  overrides?: Partial<{
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
  }>,
) => ({
  id: "pipeline-1",
  domainIntegrationId: "di-1",
  name: "Test Pipeline",
  description: "Test description",
  isActive: true,
  timeout: null,
  executionConfig: null,
  steps: [],
  createdById: null,
  createdBy: null,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
  ...overrides,
});

describe("PipelinesTable", () => {
  it("renders table headers", () => {
    // Act
    render(<PipelinesTable pipelines={[]} />);

    // Assert
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Created by")).toBeInTheDocument();
  });

  it("renders empty state when no pipelines", () => {
    // Act
    render(<PipelinesTable pipelines={[]} />);

    // Assert
    expect(
      screen.getByText("No pipelines yet. Create one to get started."),
    ).toBeInTheDocument();
  });

  it("renders pipeline rows when pipelines provided", () => {
    // Setup
    const pipelines = [createMockPipeline({ id: "p1" })];
    const pipelineValidationById = { p1: { valid: true, warnings: [] } };

    // Act
    render(
      <PipelinesTable
        pipelines={pipelines}
        pipelineValidationById={pipelineValidationById}
      />,
    );

    // Assert
    expect(screen.getByText("Test Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  it("displays Enabled badge for enabled pipelines (valid and active)", () => {
    // Setup
    const pipelines = [createMockPipeline({ id: "p1", isActive: true })];
    const pipelineValidationById = { p1: { valid: true, warnings: [] } };

    // Act
    render(
      <PipelinesTable
        pipelines={pipelines}
        pipelineValidationById={pipelineValidationById}
      />,
    );

    // Assert
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toHaveAttribute(
      "data-variant",
      "success",
    );
  });

  it("displays Disabled badge for inactive pipelines (valid but isActive false)", () => {
    // Setup
    const pipelines = [createMockPipeline({ id: "p1", isActive: false })];
    const pipelineValidationById = { p1: { valid: true, warnings: [] } };

    // Act
    render(
      <PipelinesTable
        pipelines={pipelines}
        pipelineValidationById={pipelineValidationById}
      />,
    );

    // Assert
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toHaveAttribute(
      "data-variant",
      "secondary",
    );
  });

  it("displays Incomplete badge for invalid pipelines", () => {
    // Setup
    const pipelines = [createMockPipeline({ id: "p1", isActive: true })];
    const pipelineValidationById = {
      p1: { valid: false, warnings: ["Step 1: missing input"] },
    };

    // Act
    render(
      <PipelinesTable
        pipelines={pipelines}
        pipelineValidationById={pipelineValidationById}
      />,
    );

    // Assert
    expect(screen.getByText("Incomplete")).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toHaveAttribute(
      "data-variant",
      "destructive",
    );
  });

  it("displays dash for null description", () => {
    // Setup
    const pipelines = [createMockPipeline({ id: "p1", description: null })];
    const pipelineValidationById = { p1: { valid: true, warnings: [] } };

    // Act
    render(
      <PipelinesTable
        pipelines={pipelines}
        pipelineValidationById={pipelineValidationById}
      />,
    );

    // Assert
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("renders row actions for each pipeline", () => {
    // Setup
    const pipelines = [
      createMockPipeline({ id: "pipeline-1", name: "Pipeline A" }),
      createMockPipeline({ id: "pipeline-2", name: "Pipeline B" }),
    ];
    const pipelineValidationById = {
      "pipeline-1": { valid: true, warnings: [] },
      "pipeline-2": { valid: true, warnings: [] },
    };

    // Act
    render(
      <PipelinesTable
        pipelines={pipelines}
        pipelineValidationById={pipelineValidationById}
      />,
    );

    // Assert
    expect(screen.getByTestId("row-actions-pipeline-1")).toBeInTheDocument();
    expect(screen.getByTestId("row-actions-pipeline-2")).toBeInTheDocument();
  });

  it("renders pipeline name as link", () => {
    // Setup
    const pipelines = [createMockPipeline({ id: "pipeline-123" })];
    const pipelineValidationById = {
      "pipeline-123": { valid: true, warnings: [] },
    };

    // Act
    render(
      <PipelinesTable
        pipelines={pipelines}
        pipelineValidationById={pipelineValidationById}
      />,
    );

    // Assert
    const link = screen.getByRole("link", { name: "Test Pipeline" });
    expect(link).toHaveAttribute("href", "/dashboard/pipelines/pipeline-123");
  });
});
