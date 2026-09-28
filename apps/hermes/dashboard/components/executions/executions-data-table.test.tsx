import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExecutionListRow } from "@/lib/execution-list";

import { ExecutionsDataTable } from "./executions-data-table";

const scheduleRun: ExecutionListRow = {
  id: "exec-1",
  source: "schedule",
  sourceId: "schedule-1",
  sourceName: "Nightly ingest",
  pipelineName: "Ingest",
  executionTime: new Date("2026-09-27T10:00:00Z"),
  runStatus: "succeeded",
  enqueueStatus: "success",
  succeededInvocationCount: 3,
  failedInvocationCount: 0,
  elapsedLabel: "2m 10s",
};

const manualRun: ExecutionListRow = {
  ...scheduleRun,
  id: "exec-2",
  source: "manual",
  sourceId: "pipeline-1",
  sourceName: null,
  runStatus: "failed",
  enqueueStatus: "failed",
  succeededInvocationCount: null,
  failedInvocationCount: null,
  elapsedLabel: null,
};

const table = () => screen.getByRole("table");

describe("ExecutionsDataTable", () => {
  it("links each run to its execution page and its source", () => {
    render(
      <ExecutionsDataTable
        tableId="test-executions"
        rows={[scheduleRun, manualRun]}
        emptyDescription="Runs show up here."
      />,
    );

    const [scheduleRow, manualRow] = within(table())
      .getAllByRole("row")
      .slice(1);

    expect(
      within(scheduleRow as HTMLElement).getByRole("link", {
        name: /Open execution from/,
      }),
    ).toHaveAttribute(
      "href",
      "/dashboard/schedules/schedule-1/executions/exec-1",
    );
    expect(
      within(scheduleRow as HTMLElement).getByRole("link", {
        name: "Nightly ingest",
      }),
    ).toHaveAttribute("href", "/dashboard/schedules/schedule-1");
    expect(
      within(manualRow as HTMLElement).getByRole("link", {
        name: /Open execution from/,
      }),
    ).toHaveAttribute(
      "href",
      "/dashboard/pipelines/pipeline-1/executions/exec-2",
    );
  });

  it("flags enqueue problems next to the run status and shows dashes for missing numbers", () => {
    render(
      <ExecutionsDataTable
        tableId="test-executions"
        rows={[manualRun]}
        emptyDescription="Runs show up here."
      />,
    );

    const row = within(table()).getAllByRole("row")[1] as HTMLElement;

    expect(within(row).getByText("Enqueue failed")).toHaveAttribute(
      "data-tone",
      "warning",
    );
    expect(within(row).getAllByText("—")).toHaveLength(2);
  });

  it("leaves out columns the page already implies", () => {
    render(
      <ExecutionsDataTable
        tableId="test-executions"
        rows={[scheduleRun]}
        omitColumns={["pipeline", "source"]}
        emptyDescription="Runs show up here."
      />,
    );

    const headers = within(table())
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual([
      "Started",
      "Run",
      "Invocations",
      "Duration",
      "Actions",
    ]);
  });

  it("puts the section title on the toolbar row", () => {
    render(
      <ExecutionsDataTable
        tableId="test-executions"
        rows={[scheduleRun]}
        title="Executions"
        emptyDescription="Runs show up here."
      />,
    );

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Executions",
    });
    const columnsButton = screen.getByRole("button", {
      name: "Customize columns",
    });

    expect(heading.parentElement?.nextElementSibling).toBe(
      columnsButton.parentElement,
    );
  });

  it("explains an empty list", () => {
    render(
      <ExecutionsDataTable
        tableId="test-executions"
        rows={[]}
        emptyDescription="Runs show up here."
      />,
    );

    expect(screen.getByText("No executions yet")).toBeInTheDocument();
    expect(screen.getByText("Runs show up here.")).toBeInTheDocument();
  });
});
