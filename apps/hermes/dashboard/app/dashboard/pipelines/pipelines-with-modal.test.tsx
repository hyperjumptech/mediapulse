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
    onEdit,
    onCreate,
  }: {
    pipelines: Array<{ id: string }>;
    onEdit: (pipelineId: string) => void;
    onCreate: () => void;
  }) => (
    <div data-testid="pipelines-table" data-count={pipelines.length}>
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
  createdById: null,
  createdBy: null,
});

const baseProps: PipelinesWithModalProps = {
  pipelines: [],
  pipelineValidationById: {},
  domainIntegrations: [
    { id: "integration-1", integrationId: "mediapulse", name: "Mediapulse" },
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
    // Act
    renderWithProvider({ pipelines: [createMockPipeline("1")] });

    // Assert
    const modal = screen.getByTestId("pipeline-form-modal");

    expect(screen.getByTestId("pipelines-table")).toHaveAttribute(
      "data-count",
      "1",
    );
    expect(modal).toHaveAttribute("data-open", "false");
    expect(modal).toHaveAttribute("data-domain-count", "1");
  });

  it("opens the create modal when the header link asks for it", () => {
    // Setup
    searchParams.current = "create=1";

    // Act
    renderWithProvider();

    // Assert
    const modal = screen.getByTestId("pipeline-form-modal");

    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-mode", "create");
  });

  it("opens the create modal from the empty state", () => {
    // Setup
    renderWithProvider();

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Empty state create" }));

    // Assert
    expect(screen.getByTestId("pipeline-form-modal")).toHaveAttribute(
      "data-open",
      "true",
    );
  });

  it("opens the edit modal for the selected row", () => {
    // Setup
    renderWithProvider({ pipelines: [createMockPipeline("pipeline-1")] });

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Edit pipeline-1" }));

    // Assert
    const modal = screen.getByTestId("pipeline-form-modal");

    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-mode", "edit");
    expect(modal).toHaveAttribute("data-edit-id", "pipeline-1");
  });
});
