import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EntityFormModalProvider } from "@/components/entity-form-modal-provider";
import type { PipelineSummary } from "@/lib/pipeline-summaries";

import {
  PipelinesWithModal,
  type PipelinesWithModalProps,
} from "./pipelines-with-modal";

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

vi.mock("./pipeline-form-modal", () => ({
  PipelineFormModal: ({
    open,
    mode,
    editPipelineId,
    domainIntegrations,
  }: {
    open: boolean;
    mode: string;
    editPipelineId: string | null;
    domainIntegrations: unknown[];
  }) => (
    <div
      data-testid="pipeline-form-modal"
      data-open={open}
      data-mode={mode}
      data-edit-id={editPipelineId ?? "none"}
      data-domain-count={domainIntegrations.length}
    />
  ),
}));

vi.mock("./pipelines-table", () => ({
  PipelinesTable: ({
    pipelines,
    urlState,
    initialColumnVisibility,
    onEdit,
    onCreate,
  }: {
    pipelines: Array<{ id: string }>;
    urlState: { total: number };
    initialColumnVisibility?: Record<string, boolean>;
    onEdit: (pipelineId: string) => void;
    onCreate: () => void;
  }) => (
    <div
      data-testid="pipelines-table"
      data-count={pipelines.length}
      data-total={urlState.total}
      data-visibility={JSON.stringify(initialColumnVisibility)}
    >
      <button type="button" onClick={onCreate}>
        Empty state create
      </button>
      {pipelines.map((pipeline) => (
        <button
          key={pipeline.id}
          type="button"
          onClick={() => onEdit(pipeline.id)}
        >
          Edit {pipeline.id}
        </button>
      ))}
    </div>
  ),
}));

const createMockPipeline = (id: string): PipelineSummary => ({
  id,
  name: `Pipeline ${id}`,
  description: null,
  isActive: true,
  updatedAt: new Date("2026-09-20T08:00:00Z"),
  createdById: null,
  createdBy: null,
  stepCount: 0,
  validation: { valid: true, warnings: [] },
});

const baseProps: PipelinesWithModalProps = {
  pipelines: [],
  urlState: {
    basePath: "/dashboard/pipelines",
    page: 1,
    pageSize: 15,
    total: 0,
    sortBy: "updated",
    sortDir: "desc",
  },
  domainIntegrations: [
    { id: "integration-1", integrationId: "primary", name: "Primary" },
  ],
};

const renderWithProvider = (props: Partial<PipelinesWithModalProps> = {}) =>
  render(
    <EntityFormModalProvider>
      <PipelinesWithModal {...baseProps} {...props} />
    </EntityFormModalProvider>,
  );

describe("PipelinesWithModal", () => {
  it("renders the table and a closed modal with domain integrations", () => {
    renderWithProvider({
      pipelines: [createMockPipeline("1")],
      urlState: { ...baseProps.urlState, total: 1 },
      initialColumnVisibility: { createdBy: false },
    });

    const table = screen.getByTestId("pipelines-table");
    const modal = screen.getByTestId("pipeline-form-modal");

    expect(table).toHaveAttribute("data-count", "1");
    expect(table).toHaveAttribute("data-total", "1");
    expect(table).toHaveAttribute(
      "data-visibility",
      JSON.stringify({ createdBy: false }),
    );
    expect(modal).toHaveAttribute("data-open", "false");
    expect(modal).toHaveAttribute("data-domain-count", "1");
  });

  it("opens the create modal when the header link asks for it", () => {
    searchParams.current = "create=1";

    renderWithProvider();

    const modal = screen.getByTestId("pipeline-form-modal");

    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-mode", "create");
  });

  it("opens the create modal from the empty state", () => {
    renderWithProvider();

    fireEvent.click(screen.getByRole("button", { name: "Empty state create" }));

    expect(screen.getByTestId("pipeline-form-modal")).toHaveAttribute(
      "data-open",
      "true",
    );
  });

  it("opens the edit modal for the selected row", () => {
    renderWithProvider({ pipelines: [createMockPipeline("pipeline-1")] });

    fireEvent.click(screen.getByRole("button", { name: "Edit pipeline-1" }));

    const modal = screen.getByTestId("pipeline-form-modal");

    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-mode", "edit");
    expect(modal).toHaveAttribute("data-edit-id", "pipeline-1");
  });
});
