import React from "react";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PipelineExecutionRow } from "@/lib/pipeline-executions";

const getPipelineExecutionsPageMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/pipeline-executions", () => ({
  getPipelineExecutionsPage: (...args: unknown[]) =>
    getPipelineExecutionsPageMock(...args),
}));

vi.mock("@/lib/data-table/read-column-visibility", () => ({
  readColumnVisibility: async () => ({ duration: false }),
}));

vi.mock("@/components/list-pagination", () => ({
  ListPagination: ({
    basePath,
    page,
    pageSize,
    total,
    ariaLabel,
    sortDir,
  }: {
    basePath: string;
    page: number;
    pageSize: number;
    total: number;
    ariaLabel: string;
    sortDir?: string;
  }) => (
    <nav
      data-testid="executions-pagination"
      aria-label={ariaLabel}
      data-base-path={basePath}
      data-page={page}
      data-page-size={pageSize}
      data-total={total}
      data-sort-dir={sortDir}
    />
  ),
}));

import { PipelineExecutionsSection } from "./pipeline-executions-section";

const createExecution = (
  overrides?: Partial<PipelineExecutionRow>,
): PipelineExecutionRow => ({
  id: "manual-1",
  source: "manual",
  sourceId: "pipeline-1",
  sourceName: null,
  executionTime: new Date("2026-09-28T11:50:00Z"),
  enqueueStatus: "success",
  runStatus: "succeeded",
  jobsCreated: 2,
  jobsEnqueued: 2,
  succeededInvocationCount: 2,
  failedInvocationCount: 0,
  createdAt: new Date("2026-09-28T11:50:00Z"),
  elapsedLabel: "1m 5s",
  ...overrides,
});

const scheduleExecution = createExecution({
  id: "schedule-exec-1",
  source: "schedule",
  sourceId: "schedule-1",
  sourceName: "Nightly digest",
});

const httpTriggerExecution = createExecution({
  id: "trigger-exec-1",
  source: "http-trigger",
  sourceId: "trigger-1",
  sourceName: null,
});

const renderSection = async (executions: PipelineExecutionRow[]) => {
  getPipelineExecutionsPageMock.mockResolvedValue({
    executions,
    total: 12,
    page: 2,
    pageSize: 10,
  });

  render(
    await PipelineExecutionsSection({
      pipelineId: "pipeline-1",
      page: 2,
      pageSize: 10,
    }),
  );
};

const bodyRows = () =>
  within(screen.getByRole("table")).getAllByRole("row").slice(1);

describe("PipelineExecutionsSection", () => {
  afterEach(() => {
    getPipelineExecutionsPageMock.mockReset();
  });

  it("loads the requested page and pages through it on the pipeline URL", async () => {
    await renderSection([createExecution()]);

    const pagination = screen.getByTestId("executions-pagination");

    expect(getPipelineExecutionsPageMock).toHaveBeenCalledWith(
      "pipeline-1",
      2,
      10,
    );
    expect(pagination).toHaveAttribute(
      "aria-label",
      "Pipeline executions pagination",
    );
    expect(pagination).toHaveAttribute(
      "data-base-path",
      "/dashboard/pipelines/pipeline-1",
    );
    expect(pagination).toHaveAttribute("data-page", "2");
    expect(pagination).toHaveAttribute("data-page-size", "10");
    expect(pagination).toHaveAttribute("data-total", "12");
    expect(pagination).toHaveAttribute("data-sort-dir", "desc");
  });

  it("uses a preloaded executions page instead of loading again", async () => {
    const executionsPage = Promise.resolve({
      executions: [createExecution()],
      total: 1,
      page: 1,
      pageSize: 15,
    });

    render(
      await PipelineExecutionsSection({
        pipelineId: "pipeline-1",
        page: 1,
        pageSize: 15,
        executionsPage,
      }),
    );

    expect(getPipelineExecutionsPageMock).not.toHaveBeenCalled();
    expect(bodyRows()).toHaveLength(1);
  });

  it("leaves out the pipeline column and applies saved column choices", async () => {
    await renderSection([createExecution()]);

    const headers = within(screen.getByRole("table"))
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual([
      "Started",
      "Source",
      "Run",
      "Invocations",
      "Actions",
    ]);
  });

  it("links each execution to the detail page of its source", async () => {
    await renderSection([
      createExecution(),
      scheduleExecution,
      httpTriggerExecution,
    ]);

    const detailHrefs = bodyRows().map((row) =>
      within(row)
        .getByRole("link", { name: /Open execution from/ })
        .getAttribute("href"),
    );

    expect(detailHrefs).toEqual([
      "/dashboard/pipelines/pipeline-1/executions/manual-1",
      "/dashboard/schedules/schedule-1/executions/schedule-exec-1",
      "/dashboard/http-triggers/trigger-1/executions/trigger-exec-1",
    ]);
  });

  it("links a named source and leaves an unnamed one as a badge", async () => {
    await renderSection([scheduleExecution, httpTriggerExecution]);

    const [scheduleRow, triggerRow] = bodyRows() as HTMLElement[];

    expect(
      within(scheduleRow as HTMLElement).getByRole("link", {
        name: "Nightly digest",
      }),
    ).toHaveAttribute("href", "/dashboard/schedules/schedule-1");
    expect(
      within(triggerRow as HTMLElement).getByText("Trigger"),
    ).toBeVisible();
    expect(within(triggerRow as HTMLElement).getAllByRole("link")).toHaveLength(
      1,
    );
  });

  it("explains where runs come from when there are none", async () => {
    await renderSection([]);

    expect(screen.getByText("No executions yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Runs from this pipeline's schedules, HTTP triggers and manual runs show up here.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
