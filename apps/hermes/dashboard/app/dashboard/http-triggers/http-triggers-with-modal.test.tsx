import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EntityFormModalProvider } from "@/components/entity-form-modal-provider";

import type { HttpTriggerRow } from "./http-triggers-table";
import {
  HttpTriggersWithModal,
  type HttpTriggersWithModalProps,
} from "./http-triggers-with-modal";

const { searchParams } = vi.hoisted(() => ({
  searchParams: { current: "" },
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useSearchParams: () => new URLSearchParams(searchParams.current),
}));

afterEach(() => {
  searchParams.current = "";
});

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

vi.mock("./http-triggers-table", () => ({
  HttpTriggersTable: ({
    httpTriggers,
    urlState,
    initialColumnVisibility,
    onEdit,
    onCreate,
  }: {
    httpTriggers: Array<{ id: string }>;
    urlState: { basePath: string; total: number; search?: string };
    initialColumnVisibility?: Record<string, boolean>;
    onEdit: (httpTriggerId: string) => void;
    onCreate: () => void;
  }) => (
    <div
      data-testid="http-triggers-table"
      data-count={httpTriggers.length}
      data-base-path={urlState.basePath}
      data-total={urlState.total}
      data-search={urlState.search ?? ""}
      data-visibility={JSON.stringify(initialColumnVisibility ?? {})}
    >
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
  urlState: {
    basePath: "/dashboard/http-triggers",
    page: 1,
    pageSize: 15,
    total: 0,
    sortBy: "name",
    sortDir: "asc",
  },
};

const renderWithProvider = (props: Partial<HttpTriggersWithModalProps> = {}) =>
  render(
    <EntityFormModalProvider>
      <HttpTriggersWithModal {...baseProps} {...props} />
    </EntityFormModalProvider>,
  );

describe("HttpTriggersWithModal", () => {
  it("hands the table its rows, URL state and column choices next to a closed modal", () => {
    renderWithProvider({
      httpTriggers: [createMockTrigger("trigger-1")],
      urlState: { ...baseProps.urlState, total: 16, search: "webhook" },
      initialColumnVisibility: { lastTriggered: false },
    });

    const table = screen.getByTestId("http-triggers-table");
    const modal = screen.getByTestId("http-trigger-form-modal");

    expect(table).toHaveAttribute("data-count", "1");
    expect(table).toHaveAttribute("data-base-path", "/dashboard/http-triggers");
    expect(table).toHaveAttribute("data-total", "16");
    expect(table).toHaveAttribute("data-search", "webhook");
    expect(table).toHaveAttribute(
      "data-visibility",
      JSON.stringify({ lastTriggered: false }),
    );
    expect(modal).toHaveAttribute("data-open", "false");
    expect(modal).toHaveAttribute("data-pipelines-count", "1");
  });

  it("opens the create modal when the header link asks for it", () => {
    searchParams.current = "create=1";

    renderWithProvider();

    const modal = screen.getByTestId("http-trigger-form-modal");

    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-mode", "create");
  });

  it("opens the create modal from the empty state", () => {
    renderWithProvider();

    fireEvent.click(screen.getByRole("button", { name: "Empty state create" }));

    const modal = screen.getByTestId("http-trigger-form-modal");

    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-mode", "create");
  });

  it("opens the edit modal for the selected row", () => {
    renderWithProvider({ httpTriggers: [createMockTrigger("trigger-1")] });

    fireEvent.click(screen.getByRole("button", { name: "Edit trigger-1" }));

    const modal = screen.getByTestId("http-trigger-form-modal");

    expect(modal).toHaveAttribute("data-mode", "edit");
    expect(modal).toHaveAttribute("data-edit-id", "trigger-1");
  });
});
