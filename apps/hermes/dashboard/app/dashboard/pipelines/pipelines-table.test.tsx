import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@workspace/ui/components/tooltip";

import type { PipelineSummary } from "@/lib/pipeline-summaries";

import { PipelinesTable } from "./pipelines-table";

vi.mock("./pipeline-row-actions", () => ({
  PipelineRowActions: ({
    pipelineId,
    pipelineName,
    onEdit,
  }: {
    pipelineId: string;
    pipelineName: string;
    onEdit?: (pipelineId: string) => void;
  }) => (
    <button
      type="button"
      data-testid={`row-actions-${pipelineId}`}
      data-name={pipelineName}
      onClick={() => onEdit?.(pipelineId)}
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
  updatedAt: new Date("2026-09-20T08:00:00Z"),
  createdById: null,
  createdBy: { id: "user-1", name: "Ada Lovelace", email: "ada@example.com" },
  stepCount: 3,
  validation: { valid: true, warnings: [] },
  ...overrides,
});

const urlState = {
  basePath: "/dashboard/pipelines",
  page: 1,
  pageSize: 15,
  total: 1,
  sortBy: "updated",
  sortDir: "desc" as const,
};

const renderTable = (
  props: Partial<React.ComponentProps<typeof PipelinesTable>> = {},
) =>
  render(
    <TooltipProvider>
      <PipelinesTable
        pipelines={[createMockPipeline()]}
        urlState={urlState}
        {...props}
      />
    </TooltipProvider>,
  );

const table = () => screen.getByRole("table");

const firstRow = () => within(table()).getAllByRole("row")[1] as HTMLElement;

const headerLabels = () =>
  within(table())
    .getAllByRole("columnheader")
    .map((header) => header.textContent);

const openMenu = async (trigger: HTMLElement) => {
  await act(async () => {
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  });
};

describe("PipelinesTable", () => {
  it("shows the useful columns and keeps Created by in the column menu", () => {
    renderTable();

    expect(headerLabels()).toEqual([
      "Name",
      "Description",
      "Steps",
      "Status",
      "Updated",
      "Actions",
    ]);
  });

  it("shows Created by when the saved column choices include it", () => {
    renderTable({ initialColumnVisibility: {} });

    expect(headerLabels()).toContain("Created by");
    expect(within(firstRow()).getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("renders a row with a detail link, description, step count and status", () => {
    renderTable({ pipelines: [createMockPipeline({ id: "pipeline-123" })] });

    const row = firstRow();

    expect(
      within(row).getByRole("link", { name: "Test Pipeline" }),
    ).toHaveAttribute("href", "/dashboard/pipelines/pipeline-123");
    expect(within(row).getByText("Test description")).toHaveAttribute(
      "title",
      "Test description",
    );
    expect(within(row).getByText("3")).toBeInTheDocument();
    expect(within(row).getByText("Enabled")).toHaveAttribute(
      "data-tone",
      "success",
    );
    expect(within(row).getByTestId("row-actions-pipeline-123")).toHaveAttribute(
      "data-name",
      "Test Pipeline",
    );
  });

  it("hands the edit handler to the row actions", () => {
    const onEdit = vi.fn();
    renderTable({ onEdit });

    fireEvent.click(within(firstRow()).getByTestId("row-actions-pipeline-1"));

    expect(onEdit).toHaveBeenCalledWith("pipeline-1");
  });

  it("shows inactive pipelines as disabled", () => {
    renderTable({ pipelines: [createMockPipeline({ isActive: false })] });

    expect(within(firstRow()).getByText("Disabled")).toHaveAttribute(
      "data-tone",
      "muted",
    );
  });

  it("shows invalid pipelines as incomplete with their warnings", () => {
    renderTable({
      pipelines: [
        createMockPipeline({
          validation: { valid: false, warnings: ["Step 1: missing input"] },
        }),
      ],
    });

    const row = firstRow();

    expect(
      within(row).getByRole("button", { name: "Incomplete" }),
    ).toBeVisible();
    expect(within(row).getByText("Incomplete")).toHaveAttribute(
      "data-tone",
      "warning",
    );
  });

  it("displays a dash for a missing description", () => {
    renderTable({ pipelines: [createMockPipeline({ description: "  " })] });

    expect(within(firstRow()).getByText("—")).toBeInTheDocument();
  });

  it("marks the sorted column from the URL state", () => {
    renderTable();

    expect(
      within(table()).getByRole("columnheader", { name: "Updated" }),
    ).toHaveAttribute("aria-sort", "descending");
    expect(
      within(table()).getByRole("columnheader", { name: "Name" }),
    ).not.toHaveAttribute("aria-sort");
  });

  it("sorts by name through the URL", async () => {
    renderTable();

    await openMenu(within(table()).getByRole("button", { name: "Name" }));

    expect(screen.getByRole("menuitem", { name: "Asc" })).toHaveAttribute(
      "href",
      "/dashboard/pipelines?page=1&size=15&sort=name&dir=asc",
    );
  });

  it("offers a search box for name and description", () => {
    renderTable();

    expect(
      screen.getByRole("search", {
        name: "Search pipelines by name or description",
      }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Filter pipelines…")).toBeVisible();
  });

  it("invites creating the first pipeline when there are none", () => {
    const onCreate = vi.fn();
    renderTable({ pipelines: [], onCreate });

    fireEvent.click(screen.getByRole("button", { name: "New pipeline" }));

    expect(screen.getByText("No pipelines yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("omits the create action from the empty state without a handler", () => {
    renderTable({ pipelines: [] });

    expect(screen.getByText("No pipelines yet")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New pipeline" }),
    ).not.toBeInTheDocument();
  });
});
