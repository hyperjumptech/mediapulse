import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  PipelineAvailableAgents,
  type PipelineAvailableAgentsProps,
} from "./pipeline-available-agents";

vi.mock(
  "@/app/dashboard/pipelines/actions/add-step/.generated/form.action",
  () => ({ formAction: vi.fn() }),
);

type AddStepFormAction = NonNullable<
  PipelineAvailableAgentsProps["addStepFormAction"]
>;

const agents = [
  {
    id: "agent-1",
    agentId: "collector",
    agentVersion: "1.0",
    description: "Collects articles",
  },
  {
    id: "agent-2",
    agentId: "summarizer",
    agentVersion: "2.0",
    description: null,
  },
];

describe("PipelineAvailableAgents", () => {
  it("lists agents that are not yet steps", () => {
    // Act
    render(
      <PipelineAvailableAgents
        pipelineId="pipeline-1"
        agents={agents}
        existingStepAgentKeys={["summarizer@2.0"]}
      />,
    );

    // Assert
    expect(
      screen.getByRole("heading", { level: 2, name: "Available agents" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add collector@1.0 to the pipeline" }),
    ).toHaveTextContent("Collects articles");
    expect(
      screen.queryByRole("button", {
        name: "Add summarizer@2.0 to the pipeline",
      }),
    ).not.toBeInTheDocument();
  });

  it("explains when every registered agent is already a step", () => {
    // Act
    render(
      <PipelineAvailableAgents
        pipelineId="pipeline-1"
        agents={agents}
        existingStepAgentKeys={["collector@1.0", "summarizer@2.0"]}
      />,
    );

    // Assert
    expect(
      screen.getByText("All registered agents are already in this pipeline."),
    ).toBeInTheDocument();
  });

  it("explains when the integration has no active agents", () => {
    // Act
    render(
      <PipelineAvailableAgents
        pipelineId="pipeline-1"
        agents={[]}
        existingStepAgentKeys={[]}
      />,
    );

    // Assert
    expect(
      screen.getByText(
        "No active agents are registered for this pipeline's integration.",
      ),
    ).toBeInTheDocument();
  });

  it("adds the clicked agent as a step", async () => {
    // Setup
    const addStepFormAction = vi
      .fn()
      .mockResolvedValue({ status: true }) as unknown as AddStepFormAction;
    render(
      <PipelineAvailableAgents
        pipelineId="pipeline-1"
        agents={agents}
        existingStepAgentKeys={[]}
        addStepFormAction={addStepFormAction}
      />,
    );

    // Act
    fireEvent.click(
      screen.getByRole("button", { name: "Add collector@1.0 to the pipeline" }),
    );

    // Assert
    await waitFor(() => {
      expect(addStepFormAction).toHaveBeenCalledTimes(1);
    });
    const [, formData] = vi.mocked(addStepFormAction).mock.calls[0] as [
      unknown,
      FormData,
    ];

    expect(formData.get("body.pipelineId")).toBe("pipeline-1");
    expect(formData.get("body.agentId")).toBe("collector");
    expect(formData.get("body.agentVersion")).toBe("1.0");
    expect(formData.get("body.input")).toBe("{}");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the error message when adding fails", async () => {
    // Setup
    const addStepFormAction = vi.fn().mockResolvedValue({
      status: false,
      message: "Agent already in pipeline",
    }) as unknown as AddStepFormAction;
    render(
      <PipelineAvailableAgents
        pipelineId="pipeline-1"
        agents={agents}
        existingStepAgentKeys={[]}
        addStepFormAction={addStepFormAction}
      />,
    );

    // Act
    fireEvent.click(
      screen.getByRole("button", {
        name: "Add summarizer@2.0 to the pipeline",
      }),
    );

    // Assert
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Agent already in pipeline",
    );
  });
});
