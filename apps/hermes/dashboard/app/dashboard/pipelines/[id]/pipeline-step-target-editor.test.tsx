import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  PipelineStepTargetEditor,
  type PipelineStepTargetEditorProps,
} from "./pipeline-step-target-editor";

vi.mock(
  "@/app/dashboard/pipelines/actions/update-pipeline-step/.generated/form.action",
  () => ({ formAction: vi.fn() }),
);

type UpdatePipelineStepFormAction = NonNullable<
  PipelineStepTargetEditorProps["updatePipelineStepFormAction"]
>;

const pipelines = [
  { id: "p-collect", name: "Collection", description: null },
  { id: "p-delivery", name: "Delivery", description: null },
];

const step = {
  id: "step-1",
  targetPipelineId: "p-collect",
  input: { itemId: "{{params.itemId}}" },
};

const renderEditor = (
  updatePipelineStepFormAction: ReturnType<typeof vi.fn> = vi
    .fn()
    .mockResolvedValue({ status: true, data: { ok: true } }),
  includedStepLabels = ["Collection › collect@1.0.0"],
) => {
  render(
    <PipelineStepTargetEditor
      pipelineId="p-root"
      step={step}
      pipelines={pipelines}
      includedStepLabels={includedStepLabels}
      updatePipelineStepFormAction={
        updatePipelineStepFormAction as unknown as UpdatePipelineStepFormAction
      }
    />,
  );

  return updatePipelineStepFormAction;
};

describe("PipelineStepTargetEditor", () => {
  it("shows the target, the overrides and the steps it runs", () => {
    renderEditor();

    expect(screen.getByLabelText("Pipeline")).toHaveValue("p-collect");
    expect(screen.getByLabelText("Input overrides")).toHaveValue(
      JSON.stringify({ itemId: "{{params.itemId}}" }, null, 2),
    );
    expect(screen.getByText("1. Collection › collect@1.0.0")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open this pipeline" }),
    ).toHaveAttribute("href", "/dashboard/pipelines/p-collect");
  });

  it("saves a new target and overrides", async () => {
    const updatePipelineStepFormAction = renderEditor();

    fireEvent.change(screen.getByLabelText("Pipeline"), {
      target: { value: "p-delivery" },
    });
    fireEvent.change(screen.getByLabelText("Input overrides"), {
      target: { value: '{"itemId":"fixed"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Step saved")).toBeVisible();
    const formData = updatePipelineStepFormAction.mock
      .calls[0]?.[1] as FormData;
    expect(formData.get("body.pipelineId")).toBe("p-root");
    expect(formData.get("body.stepId")).toBe("step-1");
    expect(formData.get("body.targetPipelineId")).toBe("p-delivery");
    expect(formData.get("body.input")).toBe('{"itemId":"fixed"}');
  });

  it("shows why a save was refused", async () => {
    renderEditor(
      vi.fn().mockResolvedValue({
        status: false,
        message: "Overrides must be a JSON object, for example {}",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByText("Step not saved")).toBeVisible(),
    );
    expect(
      screen.getByText("Overrides must be a JSON object, for example {}"),
    ).toBeVisible();
  });

  it("asks to save before listing steps when none are known", () => {
    renderEditor(undefined, []);

    expect(screen.getByText("Save to see the steps it runs.")).toBeVisible();
  });

  it("keeps the saved confirmation when the page refreshes the same step", async () => {
    const updatePipelineStepFormAction = vi
      .fn()
      .mockResolvedValue({ status: true, data: { ok: true } });
    const props = {
      pipelineId: "p-root",
      pipelines,
      includedStepLabels: [],
      updatePipelineStepFormAction:
        updatePipelineStepFormAction as unknown as UpdatePipelineStepFormAction,
    };
    const { rerender } = render(
      <PipelineStepTargetEditor {...props} step={step} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Step saved");
    rerender(
      <PipelineStepTargetEditor
        {...props}
        step={{ ...step, input: { itemId: "{{params.itemId}}" } }}
      />,
    );

    expect(screen.getByText("Step saved")).toBeVisible();
  });
});
