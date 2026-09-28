import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HttpTriggersPageResult } from "@/lib/http-triggers";

import { HttpTriggersTable } from "./http-triggers-table";

type HttpTriggerRow = HttpTriggersPageResult["httpTriggers"][number];

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
    "aria-label": ariaLabel,
    "aria-sort": ariaSort,
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a
      href={href}
      className={className}
      aria-label={ariaLabel}
      aria-sort={ariaSort}
    >
      {children}
    </a>
  ),
}));

vi.mock("./http-trigger-row-actions", () => ({
  HttpTriggerRowActions: ({
    httpTriggerId,
    httpTriggerName,
    method,
  }: {
    httpTriggerId: string;
    httpTriggerName: string;
    method: string;
  }) => (
    <button
      type="button"
      data-testid={`row-actions-${httpTriggerId}`}
      data-name={httpTriggerName}
      data-method={method}
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

const renderTable = (
  props: Partial<React.ComponentProps<typeof HttpTriggersTable>> = {},
) =>
  render(
    <HttpTriggersTable
      httpTriggers={[createMockTrigger()]}
      sortBy="name"
      sortDir="asc"
      pageSize={15}
      onEdit={vi.fn()}
      onCreate={vi.fn()}
      {...props}
    />,
  );

describe("HttpTriggersTable", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the column headers", () => {
    // Act
    renderTable();

    // Assert
    const headers = screen
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual([
      "Name",
      "Pipeline",
      "Method",
      "Status",
      "Last triggered",
      "Created",
      "Created by",
      "Actions",
    ]);
  });

  it("toggles the active sort direction and keeps the search", () => {
    // Act
    renderTable({ sortBy: "method", sortDir: "desc", searchQuery: "hook" });

    // Assert
    expect(screen.getByRole("link", { name: "Method" })).toHaveAttribute(
      "href",
      "/dashboard/http-triggers?page=1&size=15&q=hook&sort=method&dir=asc",
    );
    expect(screen.getByRole("link", { name: "Method" })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(screen.getByRole("link", { name: "Status" })).toHaveAttribute(
      "href",
      "/dashboard/http-triggers?page=1&size=15&q=hook&sort=enabled&dir=asc",
    );
  });

  it("renders a row with links, method, status, timestamps, and creator", () => {
    // Act
    renderTable();

    // Assert
    const row = screen.getByRole("row", { name: /Inbound webhook/ });

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
    expect(within(row).getByText("5m ago")).toBeInTheDocument();
    expect(within(row).getByText("Jan 8, 09:00")).toBeInTheDocument();
    expect(within(row).getByText("user-1")).toBeInTheDocument();
    expect(screen.getByTestId("row-actions-trigger-1")).toHaveAttribute(
      "data-method",
      "POST",
    );
  });

  it("shows Never for triggers that have not been called", () => {
    // Act
    renderTable({
      httpTriggers: [
        createMockTrigger({ lastTriggeredAt: null, enabled: false }),
      ],
    });

    // Assert
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.getByText("disabled")).toHaveAttribute("data-tone", "muted");
  });

  it("invites creating the first trigger when there are none", () => {
    // Setup
    const onCreate = vi.fn();
    renderTable({ httpTriggers: [], onCreate });

    // Act
    fireEvent.click(screen.getByRole("button", { name: "New HTTP trigger" }));

    // Assert
    expect(screen.getByText("No HTTP triggers yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("offers to clear the search when nothing matches", () => {
    // Act
    renderTable({ httpTriggers: [], searchQuery: "hook" });

    // Assert
    expect(
      screen.getByText("No HTTP triggers match “hook”"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/dashboard/http-triggers?page=1&size=15&sort=name&dir=asc",
    );
  });
});
