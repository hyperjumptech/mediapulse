import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  EntityFormModalCreateButton,
  EntityFormModalProvider,
} from "@/components/entity-form-modal-provider";
import type { HttpTriggersPageResult } from "@/lib/http-triggers";

import {
  HttpTriggersWithModal,
  type HttpTriggersWithModalProps,
} from "./http-triggers-with-modal";

type HttpTriggerRow = HttpTriggersPageResult["httpTriggers"][number];

vi.mock("@/components/list-pagination", () => ({
  ListPagination: ({
    page,
    total,
    basePath,
  }: {
    page: number;
    total: number;
    basePath: string;
  }) => (
    <nav
      data-testid="pagination"
      data-page={page}
      data-total={total}
      data-base-path={basePath}
    />
  ),
}));

vi.mock("./http-trigger-form-modal", () => ({
  HttpTriggerFormModal: ({
    open,
    mode,
    editHttpTriggerId,
    pipelines,
  }: {
    open: boolean;
    mode: string;
    editHttpTriggerId: string | null;
    pipelines: unknown[];
  }) => (
    <div
      data-testid="http-trigger-form-modal"
      data-open={open}
      data-mode={mode}
      data-edit-id={editHttpTriggerId ?? "none"}
      data-pipelines-count={pipelines.length}
    />
  ),
}));

vi.mock("./http-triggers-search", () => ({
  HttpTriggersSearch: ({ initialQuery }: { initialQuery?: string }) => (
    <div data-testid="http-triggers-search" data-query={initialQuery ?? ""} />
  ),
}));

vi.mock("./http-triggers-table", () => ({
  HttpTriggersTable: ({
    httpTriggers,
    onEdit,
    onCreate,
  }: {
    httpTriggers: Array<{ id: string }>;
    onEdit: (httpTriggerId: string) => void;
    onCreate: () => void;
  }) => (
    <div data-testid="http-triggers-table" data-count={httpTriggers.length}>
      <button type="button" onClick={onCreate}>
        Empty state create
      </button>
      {httpTriggers.map((trigger) => (
        <button
          key={trigger.id}
          type="button"
          onClick={() => onEdit(trigger.id)}
        >
          Edit {trigger.id}
        </button>
      ))}
    </div>
  ),
}));

const createMockTrigger = (id: string): HttpTriggerRow =>
  ({
    id,
    name: `Trigger ${id}`,
    method: "POST",
    enabled: true,
    pipeline: { id: "pipeline-1", name: "Ingest" },
    createdAt: new Date("2024-01-01"),
  }) as HttpTriggerRow;

const baseProps: HttpTriggersWithModalProps = {
  httpTriggers: [],
  pipelines: [{ id: "pipeline-1", name: "Ingest", isActive: true }],
  currentPage: 1,
  pageSize: 15,
  total: 0,
  sortBy: "name",
  sortDir: "asc",
};

const renderWithProvider = (props: Partial<HttpTriggersWithModalProps> = {}) =>
  render(
    <EntityFormModalProvider>
      <EntityFormModalCreateButton label="New HTTP trigger" />
      <HttpTriggersWithModal {...baseProps} {...props} />
    </EntityFormModalProvider>,
  );

describe("HttpTriggersWithModal", () => {
  it("renders search, table, pagination, and a closed modal", () => {
    // Act
    renderWithProvider({
      httpTriggers: [createMockTrigger("trigger-1")],
      currentPage: 2,
      total: 16,
      searchQuery: "webhook",
    });

    // Assert
    const pagination = screen.getByTestId("pagination");
    const modal = screen.getByTestId("http-trigger-form-modal");

    expect(screen.getByTestId("http-triggers-search")).toHaveAttribute(
      "data-query",
      "webhook",
    );
    expect(screen.getByTestId("http-triggers-table")).toHaveAttribute(
      "data-count",
      "1",
    );
    expect(pagination).toHaveAttribute("data-page", "2");
    expect(pagination).toHaveAttribute("data-total", "16");
    expect(pagination).toHaveAttribute(
      "data-base-path",
      "/dashboard/http-triggers",
    );
    expect(modal).toHaveAttribute("data-open", "false");
    expect(modal).toHaveAttribute("data-pipelines-count", "1");
  });

  it("opens the create modal from the page header button", () => {
    // Setup
    renderWithProvider();

    // Act
    fireEvent.click(screen.getByRole("button", { name: "New HTTP trigger" }));

    // Assert
    const modal = screen.getByTestId("http-trigger-form-modal");

    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-mode", "create");
  });

  it("opens the create modal from the empty state", () => {
    // Setup
    renderWithProvider();

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Empty state create" }));

    // Assert
    expect(screen.getByTestId("http-trigger-form-modal")).toHaveAttribute(
      "data-open",
      "true",
    );
  });

  it("opens the edit modal for the selected row", () => {
    // Setup
    renderWithProvider({
      httpTriggers: [createMockTrigger("trigger-1")],
      total: 1,
    });

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Edit trigger-1" }));

    // Assert
    const modal = screen.getByTestId("http-trigger-form-modal");

    expect(modal).toHaveAttribute("data-mode", "edit");
    expect(modal).toHaveAttribute("data-edit-id", "trigger-1");
  });
});
