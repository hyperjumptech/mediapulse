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
  name: "Test Pipeline",
  description: "Test description",
  isActive: true,
  steps: [],
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
    const pipelines = [createMockPipeline()];

    // Act
    render(<PipelinesTable pipelines={pipelines} />);

    // Assert
    expect(screen.getByText("Test Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  it("displays Active badge for active pipelines", () => {
    // Setup
    const pipelines = [createMockPipeline({ isActive: true })];

    // Act
    render(<PipelinesTable pipelines={pipelines} />);

    // Assert
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toHaveAttribute(
      "data-variant",
      "success",
    );
  });

  it("displays Inactive badge for inactive pipelines", () => {
    // Setup
    const pipelines = [createMockPipeline({ isActive: false })];

    // Act
    render(<PipelinesTable pipelines={pipelines} />);

    // Assert
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toHaveAttribute(
      "data-variant",
      "secondary",
    );
  });

  it("displays dash for null description", () => {
    // Setup
    const pipelines = [createMockPipeline({ description: null })];

    // Act
    render(<PipelinesTable pipelines={pipelines} />);

    // Assert
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders row actions for each pipeline", () => {
    // Setup
    const pipelines = [
      createMockPipeline({ id: "pipeline-1", name: "Pipeline A" }),
      createMockPipeline({ id: "pipeline-2", name: "Pipeline B" }),
    ];

    // Act
    render(<PipelinesTable pipelines={pipelines} />);

    // Assert
    expect(screen.getByTestId("row-actions-pipeline-1")).toBeInTheDocument();
    expect(screen.getByTestId("row-actions-pipeline-2")).toBeInTheDocument();
  });

  it("renders pipeline name as link", () => {
    // Setup
    const pipelines = [createMockPipeline({ id: "pipeline-123" })];

    // Act
    render(<PipelinesTable pipelines={pipelines} />);

    // Assert
    const link = screen.getByRole("link", { name: "Test Pipeline" });
    expect(link).toHaveAttribute("href", "/dashboard/pipelines/pipeline-123");
  });
});
