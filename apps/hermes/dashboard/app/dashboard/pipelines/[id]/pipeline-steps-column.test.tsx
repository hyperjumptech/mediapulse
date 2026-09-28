import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockUseFormAction } from "@/test-utils";

import { PipelineStepsColumn } from "./pipeline-steps-column";

const removeStepFormActionMock = vi.hoisted(() => vi.fn());
const reorderStepsFormActionMock = vi.hoisted(() => vi.fn());

vi.mock(
  "@/app/dashboard/pipelines/actions/remove-step/.generated/use-form-action",
  () => ({ useFormAction: () => removeStepFormActionMock() }),
);

vi.mock(
  "@/app/dashboard/pipelines/actions/reorder-steps/.generated/use-form-action",
  () => ({ useFormAction: () => reorderStepsFormActionMock() }),
);

const createStep = (id: string, order: number, agentId: string) => ({
  id,
  order,
  agentId,
  agentVersion: "1.0",
});

const steps = [
  createStep("step-a", 0, "collector"),
  createStep("step-b", 1, "summarizer"),
  createStep("step-c", 2, "publisher"),
];

const agentDescriptions = [
  {
    id: "agent-1",
    agentId: "summarizer",
    agentVersion: "1.0",
    description: "Summarizes articles",
  },
];

const givenFormActions = (options?: {
  removeState?: { status: boolean } | null;
  pending?: boolean;
}) => {
  removeStepFormActionMock.mockReturnValue(
    createMockUseFormAction("remove-step-form", {
      state: options?.removeState ?? null,
      pending: options?.pending ?? false,
    }),
  );
  reorderStepsFormActionMock.mockReturnValue(
    createMockUseFormAction("reorder-steps-form"),
  );
};

const renderStepsColumn = (
  overrides?: Partial<React.ComponentProps<typeof PipelineStepsColumn>>,
) =>
  render(
    <PipelineStepsColumn
      pipelineId="pipeline-1"
      steps={steps}
      agentDescriptions={agentDescriptions}
      selectedStepId={null}
      onSelectStep={vi.fn()}
      {...overrides}
    />,
  );

describe("PipelineStepsColumn", () => {
  afterEach(() => {
    removeStepFormActionMock.mockReset();
    reorderStepsFormActionMock.mockReset();
  });

  it("shows an empty state when the pipeline has no steps", () => {
    // Setup
    givenFormActions();

    // Act
    renderStepsColumn({ steps: [] });

    // Assert
    expect(
      screen.getByRole("heading", { level: 2, name: /Steps/ }),
    ).toHaveTextContent("Steps0");
    expect(screen.getByText(/No steps yet/)).toBeInTheDocument();
  });

  it("lists steps in order with their agent descriptions", () => {
    // Setup
    givenFormActions();

    // Act
    renderStepsColumn();

    // Assert
    const items = screen.getAllByRole("listitem");

    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("1collector@1.0");
    expect(items[1]).toHaveTextContent("Summarizes articles");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Steps3",
    );
  });

  it("selects a step, and deselects it when clicked again", () => {
    // Setup
    givenFormActions();
    const onSelectStep = vi.fn();
    const { rerender } = renderStepsColumn({ onSelectStep });

    // Act
    fireEvent.click(screen.getByRole("button", { name: /^summarizer@1\.0/ }));
    rerender(
      <PipelineStepsColumn
        pipelineId="pipeline-1"
        steps={steps}
        agentDescriptions={agentDescriptions}
        selectedStepId="step-b"
        onSelectStep={onSelectStep}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^summarizer@1\.0/ }));

    // Assert
    const selectedItem = screen.getAllByRole("listitem")[1];

    expect(onSelectStep).toHaveBeenNthCalledWith(1, "step-b");
    expect(onSelectStep).toHaveBeenNthCalledWith(2, null);
    expect(selectedItem).toHaveAttribute("data-selected", "true");
    expect(
      screen.getByRole("button", { name: /^summarizer@1\.0/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("posts the swapped order for move up and move down", () => {
    // Setup
    givenFormActions();

    // Act
    renderStepsColumn();

    // Assert
    const middleItem = screen.getAllByRole("listitem")[1] as HTMLElement;
    const moveUpForm = within(middleItem)
      .getByRole("button", { name: "Move step up" })
      .closest("form") as HTMLFormElement;
    const moveDownForm = within(middleItem)
      .getByRole("button", { name: "Move step down" })
      .closest("form") as HTMLFormElement;
    const moveUpStepIds = moveUpForm.querySelector(
      'input[name="body.stepIds"]',
    );
    const moveDownStepIds = moveDownForm.querySelector(
      'input[name="body.stepIds"]',
    );

    expect(moveUpStepIds).toHaveValue(
      JSON.stringify(["step-b", "step-a", "step-c"]),
    );
    expect(moveDownStepIds).toHaveValue(
      JSON.stringify(["step-a", "step-c", "step-b"]),
    );
  });

  it("hides move up on the first step and move down on the last", () => {
    // Setup
    givenFormActions();

    // Act
    renderStepsColumn();

    // Assert
    const [firstItem, , lastItem] = screen.getAllByRole("listitem");

    expect(
      within(firstItem as HTMLElement).queryByRole("button", {
        name: "Move step up",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(lastItem as HTMLElement).queryByRole("button", {
        name: "Move step down",
      }),
    ).not.toBeInTheDocument();
  });

  it("posts the step id when removing a step", () => {
    // Setup
    givenFormActions();

    // Act
    renderStepsColumn();

    // Assert
    const removeForm = screen
      .getByRole("button", { name: "Remove step publisher@1.0" })
      .closest("form") as HTMLFormElement;

    expect(removeForm.querySelector('input[name="body.stepId"]')).toHaveValue(
      "step-c",
    );
    expect(
      removeForm.querySelector('input[name="body.pipelineId"]'),
    ).toHaveValue("pipeline-1");
  });

  it("disables step controls while an action is pending", () => {
    // Setup
    givenFormActions({ pending: true });

    // Act
    renderStepsColumn();

    // Assert
    expect(
      screen.getByRole("button", { name: "Remove step collector@1.0" }),
    ).toBeDisabled();
  });

  it("clears the selection after a step is removed", () => {
    // Setup
    givenFormActions({ removeState: { status: true } });
    const onSelectStep = vi.fn();

    // Act
    renderStepsColumn({ onSelectStep, selectedStepId: "step-a" });

    // Assert
    expect(onSelectStep).toHaveBeenCalledWith(null);
  });
});
