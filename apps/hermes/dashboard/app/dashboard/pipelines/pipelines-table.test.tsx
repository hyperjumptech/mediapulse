import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@workspace/ui/components/tooltip";

import type { PipelineSummary } from "@/lib/pipeline-summaries";

import { PipelinesTable } from "./pipelines-table";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
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
    <button
      type="button"
      data-testid={`row-actions-${pipelineId}`}
      data-name={pipelineName}
    >
      Actions
    </button>
  ),
}));

const createMockPipeline = (
  overrides: Partial<PipelineSummary> = {},
): PipelineSummary => ({
  id: "pipeline-1",
  name: "Test Pipeline",
  description: "Test description",
  isActive: true,
  createdById: null,
  createdBy: { id: "user-1", name: "Ada Lovelace", email: "ada@example.com" },
  ...overrides,
});

const renderTable = (
  props: Partial<React.ComponentProps<typeof PipelinesTable>> = {},
) =>
  render(
    <TooltipProvider>
      <PipelinesTable pipelines={[]} {...props} />
    </TooltipProvider>,
  );

describe("PipelinesTable", () => {
  it("renders the column headers", () => {
    // Act
    renderTable({
      pipelines: [createMockPipeline()],
      pipelineValidationById: { "pipeline-1": { valid: true, warnings: [] } },
    });

    // Assert
    const headers = screen
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual([
      "Name",
      "Description",
      "Status",
      "Created by",
      "Actions",
    ]);
  });

  it("renders a row with a detail link, description, status, and creator", () => {
    // Act
    renderTable({
      pipelines: [createMockPipeline({ id: "pipeline-123" })],
      pipelineValidationById: {
        "pipeline-123": { valid: true, warnings: [] },
      },
    });

    // Assert
    const row = screen.getByRole("row", { name: /Test Pipeline/ });

    expect(
      within(row).getByRole("link", { name: "Test Pipeline" }),
    ).toHaveAttribute("href", "/dashboard/pipelines/pipeline-123");
    expect(within(row).getByText("Test description")).toHaveAttribute(
      "title",
      "Test description",
    );
    expect(within(row).getByText("Enabled")).toHaveAttribute(
      "data-variant",
      "success",
    );
    expect(within(row).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByTestId("row-actions-pipeline-123")).toHaveAttribute(
      "data-name",
      "Test Pipeline",
    );
  });

  it("shows inactive pipelines as disabled", () => {
    // Act
    renderTable({
      pipelines: [createMockPipeline({ isActive: false })],
      pipelineValidationById: { "pipeline-1": { valid: true, warnings: [] } },
    });

    // Assert
    expect(screen.getByText("Disabled")).toHaveAttribute(
      "data-variant",
      "muted",
    );
  });

  it("shows invalid pipelines as incomplete with their warnings", () => {
    // Act
    renderTable({
      pipelines: [createMockPipeline()],
      pipelineValidationById: {
        "pipeline-1": { valid: false, warnings: ["Step 1: missing input"] },
      },
    });

    // Assert
    expect(screen.getByRole("button", { name: "Incomplete" })).toBeVisible();
    expect(screen.getByText("Incomplete")).toHaveAttribute(
      "data-variant",
      "warning",
    );
  });

  it("treats pipelines without a validation result as incomplete", () => {
    // Act
    renderTable({ pipelines: [createMockPipeline()] });

    // Assert
    expect(screen.getByText("Incomplete")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Incomplete" }),
    ).not.toBeInTheDocument();
  });

  it("displays a dash for a missing description", () => {
    // Act
    renderTable({
      pipelines: [createMockPipeline({ description: null })],
      pipelineValidationById: { "pipeline-1": { valid: true, warnings: [] } },
    });

    // Assert
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("invites creating the first pipeline when there are none", () => {
    // Setup
    const onCreate = vi.fn();
    renderTable({ onCreate });

    // Act
    fireEvent.click(screen.getByRole("button", { name: "New pipeline" }));

    // Assert
    expect(screen.getByText("No pipelines yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("omits the create action from the empty state without a handler", () => {
    // Act
    renderTable();

    // Assert
    expect(screen.getByText("No pipelines yet")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New pipeline" }),
    ).not.toBeInTheDocument();
  });
});
