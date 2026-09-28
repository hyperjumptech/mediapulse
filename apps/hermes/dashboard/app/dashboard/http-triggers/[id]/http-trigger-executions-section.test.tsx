import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getHttpTriggerExecutionsPageMock = vi.fn();
const readColumnVisibilityMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/http-triggers", () => ({
  getHttpTriggerExecutionsPage: (...args: unknown[]) =>
    getHttpTriggerExecutionsPageMock(...args),
}));

vi.mock("@/lib/data-table/read-column-visibility", () => ({
  readColumnVisibility: (...args: unknown[]) =>
    readColumnVisibilityMock(...args),
}));

vi.mock("@/components/executions/executions-data-table", () => ({
  ExecutionsDataTable: (props: Record<string, unknown>) => (
    <div
      data-testid="executions-data-table"
      data-props={JSON.stringify(props)}
    />
  ),
}));

import { HttpTriggerExecutionsSection } from "./http-trigger-executions-section";

const renderedProps = () =>
  JSON.parse(
    screen.getByTestId("executions-data-table").getAttribute("data-props") ??
      "{}",
  );

const executionRow = {
  id: "execution-1",
  source: "http-trigger",
  sourceId: "trigger-1",
  sourceName: null,
  executionTime: new Date("2026-09-27T10:00:00.000Z"),
  enqueueStatus: "partial",
  runStatus: "running",
  jobsCreated: 3,
  jobsEnqueued: 2,
  succeededInvocationCount: 1,
  failedInvocationCount: 0,
  createdAt: new Date("2026-09-27T10:00:00.000Z"),
  elapsedLabel: "In progress (12s)",
};

describe("HttpTriggerExecutionsSection", () => {
  afterEach(() => {
    getHttpTriggerExecutionsPageMock.mockReset();
    readColumnVisibilityMock.mockReset();
  });

  it("renders the shared executions table paged under the trigger", async () => {
    getHttpTriggerExecutionsPageMock.mockResolvedValue({
      executions: [executionRow],
      total: 22,
      page: 3,
      pageSize: 10,
    });
    readColumnVisibilityMock.mockResolvedValue({ invocations: false });

    render(
      await HttpTriggerExecutionsSection({
        triggerId: "trigger-1",
        page: 3,
        pageSize: 10,
      }),
    );

    expect(getHttpTriggerExecutionsPageMock).toHaveBeenCalledWith(
      "trigger-1",
      3,
      10,
    );
    expect(readColumnVisibilityMock).toHaveBeenCalledWith(
      "http-trigger-executions",
    );
    expect(renderedProps()).toEqual({
      title: "Executions",
      tableId: "http-trigger-executions",
      rows: [
        {
          id: "execution-1",
          source: "http-trigger",
          sourceId: "trigger-1",
          sourceName: null,
          pipelineName: null,
          executionTime: "2026-09-27T10:00:00.000Z",
          runStatus: "running",
          enqueueStatus: "partial",
          succeededInvocationCount: 1,
          failedInvocationCount: 0,
          elapsedLabel: "In progress (12s)",
        },
      ],
      omitColumns: ["pipeline", "source"],
      urlState: {
        basePath: "/dashboard/http-triggers/trigger-1",
        page: 3,
        pageSize: 10,
        total: 22,
        sortDir: "desc",
      },
      paginationLabel: "HTTP trigger executions pagination",
      emptyDescription:
        "Each call to this trigger's invoke URL starts a run that shows up here.",
      initialColumnVisibility: { invocations: false },
    });
  });

  it("uses the page the route already started loading", async () => {
    const executionsPage = Promise.resolve({
      executions: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });
    readColumnVisibilityMock.mockResolvedValue({});

    render(
      await HttpTriggerExecutionsSection({
        triggerId: "trigger-1",
        page: 1,
        pageSize: 15,
        executionsPage,
      }),
    );

    expect(getHttpTriggerExecutionsPageMock).not.toHaveBeenCalled();
    expect(renderedProps().rows).toEqual([]);
  });
});
