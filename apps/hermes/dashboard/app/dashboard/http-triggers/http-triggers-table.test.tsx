import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ListUrlState } from "@/lib/data-table/list-url-state";

import { HttpTriggersTable, type HttpTriggerRow } from "./http-triggers-table";

vi.mock("./http-trigger-row-actions", () => ({
  HttpTriggerRowActions: ({
    httpTriggerId,
    httpTriggerName,
    method,
    onEdit,
  }: {
    httpTriggerId: string;
    httpTriggerName: string;
    method: string;
    onEdit: (httpTriggerId: string) => void;
  }) => (
    <button
      type="button"
      data-testid={`row-actions-${httpTriggerId}`}
      data-name={httpTriggerName}
      data-method={method}
      onClick={() => onEdit(httpTriggerId)}
    >
      Actions
    </button>
  ),
}));

const now = new Date("2024-01-15T09:00:00.000Z");

const createMockTrigger = (overrides: Partial<HttpTriggerRow> = {}) =>
  ({
    id: "trigger-1",
    name: "Inbound webhook",
    description: null,
    pipelineId: "pipeline-1",
    enabled: true,
    method: "POST",
    lastTriggeredAt: new Date("2024-01-15T08:55:00.000Z"),
    pipeline: { id: "pipeline-1", name: "Ingest" },
    createdAt: new Date("2024-01-08T09:00:00.000Z"),
    createdById: "user-1",
    createdBy: null,
    ...overrides,
  }) as HttpTriggerRow;

const urlState: ListUrlState = {
  basePath: "/dashboard/http-triggers",
  page: 1,
  pageSize: 15,
  total: 1,
  sortBy: "name",
  sortDir: "asc",
};

const renderTable = (
  props: Partial<React.ComponentProps<typeof HttpTriggersTable>> = {},
) =>
  render(
    <HttpTriggersTable
      httpTriggers={[createMockTrigger()]}
      urlState={urlState}
      onEdit={vi.fn()}
      onCreate={vi.fn()}
      {...props}
    />,
  );

const table = () => screen.getByRole("table");

const openMenu = async (trigger: HTMLElement) => {
  await act(async () => {
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  });
};

describe("HttpTriggersTable", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows name, pipeline, method, status, last triggered and actions", () => {
    renderTable();

    const headers = within(table())
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual([
      "Name",
      "Pipeline",
      "Method",
      "Status",
      "Last triggered",
      "Actions",
    ]);
  });

  it("renders a row with links, method, status and last call", () => {
    renderTable();

    const row = within(table()).getAllByRole("row")[1] as HTMLElement;

    expect(
      within(row).getByRole("link", { name: "Inbound webhook" }),
    ).toHaveAttribute("href", "/dashboard/http-triggers/trigger-1");
    expect(within(row).getByRole("link", { name: "Ingest" })).toHaveAttribute(
      "href",
      "/dashboard/pipelines/pipeline-1",
    );
    expect(within(row).getByText("POST")).toHaveAttribute(
      "data-variant",
      "outline",
    );
    expect(within(row).getByText("enabled")).toHaveAttribute(
      "data-tone",
      "success",
    );
    expect(within(row).getByText("5m ago").closest("time")).toHaveAttribute(
      "datetime",
      "2024-01-15T08:55:00.000Z",
    );
    expect(within(row).getByTestId("row-actions-trigger-1")).toHaveAttribute(
      "data-method",
      "POST",
    );
  });

  it("shows Never for triggers that have not been called", () => {
    renderTable({
      httpTriggers: [
        createMockTrigger({ lastTriggeredAt: null, enabled: false }),
      ],
    });

    expect(within(table()).getByText("Never")).toBeInTheDocument();
    expect(within(table()).getByText("disabled")).toHaveAttribute(
      "data-tone",
      "muted",
    );
  });

  it("hands the row id to the edit handler", () => {
    const onEdit = vi.fn();
    renderTable({ onEdit });

    fireEvent.click(within(table()).getByTestId("row-actions-trigger-1"));

    expect(onEdit).toHaveBeenCalledWith("trigger-1");
  });

  it("marks the sorted column and leaves last triggered unsortable", () => {
    renderTable({
      urlState: { ...urlState, sortBy: "method", sortDir: "desc" },
    });

    expect(
      within(table()).getByRole("columnheader", { name: "Method" }),
    ).toHaveAttribute("aria-sort", "descending");
    expect(
      within(table()).queryByRole("button", { name: "Last triggered" }),
    ).not.toBeInTheDocument();
  });

  it("sorts the status column by enabled and keeps the search", async () => {
    renderTable({ urlState: { ...urlState, search: "hook" } });

    await openMenu(within(table()).getByRole("button", { name: "Status" }));

    expect(screen.getByRole("menuitem", { name: "Asc" })).toHaveAttribute(
      "href",
      "/dashboard/http-triggers?page=1&size=15&q=hook&sort=enabled&dir=asc",
    );
  });

  it("invites creating the first trigger when there are none", () => {
    const onCreate = vi.fn();
    renderTable({ httpTriggers: [], onCreate });

    fireEvent.click(screen.getByRole("button", { name: "New HTTP trigger" }));

    expect(screen.getByText("No HTTP triggers yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("offers to clear the search when nothing matches", () => {
    renderTable({
      httpTriggers: [],
      urlState: { ...urlState, search: "hook" },
    });

    expect(screen.getByText("Nothing matches “hook”")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/dashboard/http-triggers?page=1&size=15&sort=name&dir=asc",
    );
  });

  it("offers the HTTP trigger search box", () => {
    renderTable();

    expect(
      screen.getByRole("search", {
        name: "Search HTTP triggers by name or description",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Filter HTTP triggers…"),
    ).toBeInTheDocument();
  });
});
