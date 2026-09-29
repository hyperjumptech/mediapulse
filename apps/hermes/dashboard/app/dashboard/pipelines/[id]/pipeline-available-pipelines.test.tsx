import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  PipelineAvailablePipelines,
  type PipelineAvailablePipelinesProps,
} from "./pipeline-available-pipelines";

vi.mock(
  "@/app/dashboard/pipelines/actions/add-pipeline-step/.generated/form.action",
  () => ({ formAction: vi.fn() }),
);

type AddPipelineStepFormAction = NonNullable<
  PipelineAvailablePipelinesProps["addPipelineStepFormAction"]
>;

const pipelines = [
  { id: "p-collect", name: "Collection", description: "Collects articles" },
  { id: "p-delivery", name: "Delivery", description: null },
];

describe("PipelineAvailablePipelines", () => {
  it("lists the pipelines that can be added as a step", () => {
    render(
      <PipelineAvailablePipelines pipelineId="p-root" pipelines={pipelines} />,
    );

    expect(
      screen.getByRole("button", { name: "Add pipeline Collection as a step" }),
    ).toBeVisible();
    expect(screen.getByText("Collects articles")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Add pipeline Delivery as a step" }),
    ).toBeVisible();
  });

  it("adds the clicked pipeline as a step", async () => {
    const addPipelineStepFormAction = vi
      .fn()
      .mockResolvedValue({ status: true, data: { stepId: "s-1" } });
    render(
      <PipelineAvailablePipelines
        pipelineId="p-root"
        pipelines={pipelines}
        addPipelineStepFormAction={
          addPipelineStepFormAction as unknown as AddPipelineStepFormAction
        }
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add pipeline Delivery as a step" }),
    );

    await waitFor(() => expect(addPipelineStepFormAction).toHaveBeenCalled());
    const formData = addPipelineStepFormAction.mock.calls[0]?.[1] as FormData;
    expect(formData.get("body.pipelineId")).toBe("p-root");
    expect(formData.get("body.targetPipelineId")).toBe("p-delivery");
  });

  it("shows why a pipeline could not be added", async () => {
    const addPipelineStepFormAction = vi.fn().mockResolvedValue({
      status: false,
      message: 'Step 2 of pipeline "Root" creates a pipeline cycle',
    });
    render(
      <PipelineAvailablePipelines
        pipelineId="p-root"
        pipelines={pipelines}
        addPipelineStepFormAction={
          addPipelineStepFormAction as unknown as AddPipelineStepFormAction
        }
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add pipeline Collection as a step" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "creates a pipeline cycle",
    );
  });

  it("explains an empty list", () => {
    render(<PipelineAvailablePipelines pipelineId="p-root" pipelines={[]} />);

    expect(
      screen.getByText("No other pipelines use this pipeline's integration."),
    ).toBeVisible();
  });
});
