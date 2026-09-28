import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PipelineDetailContent,
  type PipelineDetailContentProps,
} from "./pipeline-detail-content";

const runPipelineState = vi.hoisted(() => ({
  current: null as null | { status: boolean },
}));

vi.mock(
  "@/app/dashboard/pipelines/actions/update-step/.generated/form.action",
  () => ({ formAction: vi.fn().mockResolvedValue({ status: true }) }),
);

vi.mock("./pipeline-available-agents", () => ({
  PipelineAvailableAgents: ({
    pipelineId,
    existingStepAgentKeys,
  }: {
    pipelineId: string;
    existingStepAgentKeys: string[];
  }) => (
    <div
      data-testid="pipeline-available-agents"
      data-pipeline-id={pipelineId}
      data-existing-keys={existingStepAgentKeys.join(",")}
    />
  ),
}));

vi.mock("./pipeline-steps-column", () => ({
  PipelineStepsColumn: ({
    pipelineId,
    steps,
    onSelectStep,
  }: {
    pipelineId: string;
    steps: Array<{ id: string }>;
    onSelectStep: (stepId: string | null) => void;
  }) => (
    <div
      data-testid="pipeline-steps-column"
      data-pipeline-id={pipelineId}
      data-steps-count={steps.length}
    >
      {steps.map((step) => (
        <button
          key={step.id}
          type="button"
          onClick={() => onSelectStep(step.id)}
        >
          Select {step.id}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("./pipeline-step-editor-panel", () => ({
  PipelineStepEditorPanel: ({
    selectedStep,
    stepInput,
    configsForAgent,
    stepAgentConfigId,
    stepAgentContractId,
  }: {
    selectedStep: { id: string } | null;
    stepInput: Record<string, unknown>;
    configsForAgent: Array<{ id: string }>;
    stepAgentConfigId: string;
    stepAgentContractId: string;
  }) => (
    <div
      data-testid="pipeline-step-editor-panel"
      data-selected-step-id={selectedStep?.id ?? "none"}
      data-step-input={JSON.stringify(stepInput)}
      data-configs-count={configsForAgent.length}
      data-agent-config-id={stepAgentConfigId}
      data-agent-contract-id={stepAgentContractId}
    />
  ),
}));

vi.mock("./run-pipeline-button", () => ({
  useRunPipeline: () => ({
    FormWithAction: ({ children }: { children: React.ReactNode }) => (
      <form>{children}</form>
    ),
    state: runPipelineState.current,
    pending: false,
  }),
  RunPipelineButton: ({
    pipelineId,
    disabled,
  }: {
    pipelineId: string;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      data-testid="run-pipeline-button"
      data-pipeline-id={pipelineId}
      disabled={disabled}
    >
      Run pipeline
    </button>
  ),
  RunPipelineResult: ({ state }: { state: unknown }) =>
    state ? <div data-testid="run-pipeline-result" /> : null,
}));

vi.mock("../pipeline-form-modal", () => ({
  PipelineFormModal: ({
    open,
    editPipelineId,
  }: {
    open: boolean;
    editPipelineId: string | null;
  }) => (
    <div
      data-testid="pipeline-form-modal"
      data-open={open ? "true" : "false"}
      data-edit-pipeline-id={editPipelineId ?? ""}
    />
  ),
}));

type PipelineRow = PipelineDetailContentProps["pipeline"];
type StepRow = PipelineRow["steps"][number];

const createMockStep = (overrides?: Partial<StepRow>): StepRow => ({
  id: "step-1",
  pipelineId: "pipeline-123",
  order: 0,
  agentId: "summarizer",
  agentVersion: "1.0",
  input: { topic: "news" },
  config: {},
  agentConfigId: null,
  agentContractId: null,
  createdById: null,
  createdAt: new Date("2026-09-20T12:00:00Z"),
  updatedAt: new Date("2026-09-20T12:00:00Z"),
  ...overrides,
});

const createMockPipeline = (overrides?: Partial<PipelineRow>): PipelineRow => ({
  id: "pipeline-123",
  domainIntegrationId: "di-1",
  name: "Test Pipeline",
  description: "Test description",
  isActive: true,
  timeout: null,
  executionConfig: null,
  steps: [createMockStep()],
  createdById: "u1",
  createdBy: { id: "u1", name: "Kevin", email: "kevin@example.com" },
  createdAt: new Date("2026-09-25T12:00:00Z"),
  updatedAt: new Date("2026-09-28T10:00:00Z"),
  ...overrides,
});

const createMockAgents = () => [
  {
    id: "agent-1",
    domainIntegrationId: "di-1",
    agentId: "summarizer",
    agentVersion: "1.0",
    description: "Summarizes text",
    isActive: true,
    endpoint: {},
    inputSchema: null,
    configSchema: null,
    createdAt: new Date("2026-09-20T12:00:00Z"),
    updatedAt: new Date("2026-09-20T12:00:00Z"),
  },
];

const renderPipelineDetail = (
  overrides?: Partial<PipelineDetailContentProps>,
) =>
  render(
    <PipelineDetailContent
      pipeline={createMockPipeline()}
      agents={createMockAgents()}
      configsByAgentKey={{ "summarizer@1.0": [] }}
      allContracts={[]}
      pipelineValidation={{ valid: true, warnings: [] }}
      executionsSection={<div data-testid="executions-section" />}
      domainIntegrations={[
        { id: "di-1", integrationId: "mediapulse", name: "Mediapulse" },
      ]}
      loadVariablePickerPage={vi.fn()}
      loadExpansionPickerPage={vi.fn()}
      {...overrides}
    />,
  );

const summaryValue = (label: string) => {
  const term = screen.getByText(label, { selector: "dt" });

  return term.nextElementSibling as HTMLElement;
};

const selectedStepCard = () =>
  screen
    .getByRole("heading", { level: 2, name: "Selected step" })
    .closest('[data-slot="card"]') as HTMLElement;

describe("PipelineDetailContent", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
    runPipelineState.current = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the name, status and description in the header", () => {
    // Act
    renderPipelineDetail();

    // Assert
    expect(screen.getByText("Test description")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toHaveAttribute("data-tone", "success");
  });

  it("omits the description when the pipeline has none", () => {
    // Act
    renderPipelineDetail({
      pipeline: createMockPipeline({ description: "   " }),
    });

    // Assert
    expect(screen.queryByText("No description")).not.toBeInTheDocument();
    expect(screen.queryByText("Test description")).not.toBeInTheDocument();
  });

  it("shows Disabled when the pipeline is valid but inactive", () => {
    // Act
    renderPipelineDetail({
      pipeline: createMockPipeline({ isActive: false }),
    });

    // Assert
    expect(screen.getByText("Disabled")).toHaveAttribute("data-tone", "muted");
  });

  it("lists validation warnings and disables Run when the pipeline is invalid", () => {
    // Act
    renderPipelineDetail({
      pipelineValidation: {
        valid: false,
        warnings: ["Step 1 needs an agent config", "Step 1 needs a contract"],
      },
    });

    // Assert
    const alert = screen.getByRole("alert");

    expect(screen.getByText("Incomplete")).toBeInTheDocument();
    expect(alert).toHaveTextContent("Pipeline incomplete");
    expect(within(alert).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByTestId("run-pipeline-button")).toBeDisabled();
  });

  it("shows no validation alert and enables Run for a valid pipeline", () => {
    // Act
    renderPipelineDetail();

    // Assert
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("run-pipeline-button")).toBeEnabled();
  });

  it("renders the run result once the pipeline has been run", () => {
    // Setup
    runPipelineState.current = { status: true };

    // Act
    renderPipelineDetail();

    // Assert
    expect(screen.getByTestId("run-pipeline-result")).toBeInTheDocument();
  });

  it("summarizes integration, steps, timeout and provenance", () => {
    // Act
    renderPipelineDetail();

    // Assert
    expect(summaryValue("Integration")).toHaveTextContent("Mediapulse");
    expect(summaryValue("Steps")).toHaveTextContent("1 step");
    expect(summaryValue("Agent timeout")).toHaveTextContent(
      "5 minutes (default)",
    );
    expect(summaryValue("Updated")).toHaveTextContent("Sep 28, 2026, 10:00");
    expect(summaryValue("Created")).toHaveTextContent("Sep 25, 2026, 12:00");
    expect(summaryValue("Created by")).toHaveTextContent("Kevin");
  });

  it("falls back to the integration id and shows a custom timeout", () => {
    // Act
    renderPipelineDetail({
      pipeline: createMockPipeline({
        domainIntegrationId: "di-unknown",
        timeout: 90_000,
        steps: [createMockStep(), createMockStep({ id: "step-2" })],
      }),
    });

    // Assert
    expect(summaryValue("Integration")).toHaveTextContent("di-unknown");
    expect(summaryValue("Steps")).toHaveTextContent("2 steps");
    expect(summaryValue("Agent timeout")).toHaveTextContent(
      "1 minute 30 seconds",
    );
  });

  it("renders the three editor columns", () => {
    // Act
    renderPipelineDetail();

    // Assert
    expect(screen.getByTestId("pipeline-available-agents")).toHaveAttribute(
      "data-existing-keys",
      "summarizer@1.0",
    );
    expect(screen.getByTestId("pipeline-steps-column")).toHaveAttribute(
      "data-steps-count",
      "1",
    );
    expect(
      within(selectedStepCard()).getByTestId("pipeline-step-editor-panel"),
    ).toHaveAttribute("data-selected-step-id", "none");
  });

  it("keeps Save in the selected step card and disabled until a step is selected", () => {
    // Act
    renderPipelineDetail();

    // Assert
    const card = selectedStepCard();

    expect(within(card).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(within(card).getByText("Select a step to edit it.")).toBeVisible();
  });

  it("loads the selected step into the editor", () => {
    // Setup
    renderPipelineDetail({
      pipeline: createMockPipeline({
        steps: [
          createMockStep({
            agentConfigId: "config-1",
            agentContractId: "contract-1",
          }),
        ],
      }),
    });

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Select step-1" }));

    // Assert
    const card = selectedStepCard();
    const panel = within(card).getByTestId("pipeline-step-editor-panel");

    expect(within(card).getByText("summarizer@1.0")).toBeInTheDocument();
    expect(panel).toHaveAttribute("data-selected-step-id", "step-1");
    expect(panel).toHaveAttribute("data-step-input", '{"topic":"news"}');
    expect(panel).toHaveAttribute("data-agent-config-id", "config-1");
    expect(panel).toHaveAttribute("data-agent-contract-id", "contract-1");
    expect(within(card).getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("uses an empty input when the saved step input is not an object", () => {
    // Setup
    renderPipelineDetail({
      pipeline: createMockPipeline({
        steps: [createMockStep({ input: ["unexpected"] })],
      }),
    });

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Select step-1" }));

    // Assert
    expect(screen.getByTestId("pipeline-step-editor-panel")).toHaveAttribute(
      "data-step-input",
      "{}",
    );
  });

  it("requires an agent config and contract before saving", async () => {
    // Setup
    const updateStepFormAction = vi.fn();
    renderPipelineDetail({ updateStepFormAction });
    fireEvent.click(screen.getByRole("button", { name: "Select step-1" }));

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // Assert
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Agent config and Agent contract are required.",
      );
    });
    expect(updateStepFormAction).not.toHaveBeenCalled();
  });

  it("saves the selected step and shows returned warnings", async () => {
    // Setup
    const updateStepFormAction = vi.fn().mockResolvedValue({
      status: true,
      data: { validationWarnings: ["Input field topic is unused"] },
    });
    renderPipelineDetail({
      updateStepFormAction,
      pipeline: createMockPipeline({
        steps: [
          createMockStep({
            agentConfigId: "config-1",
            agentContractId: "contract-1",
          }),
        ],
      }),
    });
    fireEvent.click(screen.getByRole("button", { name: "Select step-1" }));

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // Assert
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Saved with warnings",
      );
    });
    const [, formData] = updateStepFormAction.mock.calls[0] as [
      unknown,
      FormData,
    ];

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Input field topic is unused",
    );
    expect(formData.get("body.pipelineId")).toBe("pipeline-123");
    expect(formData.get("body.stepId")).toBe("step-1");
    expect(formData.get("body.agentConfigId")).toBe("config-1");
    expect(formData.get("body.agentContractId")).toBe("contract-1");
    expect(formData.get("body.input")).toBe('{"topic":"news"}');
  });

  it("shows nothing extra after a clean save", async () => {
    // Setup
    const updateStepFormAction = vi.fn().mockResolvedValue({ status: true });
    renderPipelineDetail({
      updateStepFormAction,
      pipeline: createMockPipeline({
        steps: [
          createMockStep({
            agentConfigId: "config-1",
            agentContractId: "contract-1",
          }),
        ],
      }),
    });
    fireEvent.click(screen.getByRole("button", { name: "Select step-1" }));

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // Assert
    await waitFor(() => {
      expect(updateStepFormAction).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    [{ status: false, message: "Contract mismatch" }, "Contract mismatch"],
    [null, "Failed to save step"],
  ])("shows the save error for %j", async (stepResult, expectedMessage) => {
    // Setup
    const updateStepFormAction = vi.fn().mockResolvedValue(stepResult);
    renderPipelineDetail({
      updateStepFormAction,
      pipeline: createMockPipeline({
        steps: [
          createMockStep({
            agentConfigId: "config-1",
            agentContractId: "contract-1",
          }),
        ],
      }),
    });
    fireEvent.click(screen.getByRole("button", { name: "Select step-1" }));

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // Assert
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Step not saved");
    });
    expect(screen.getByRole("alert")).toHaveTextContent(expectedMessage);
  });

  it("opens the edit modal from the header", () => {
    // Setup
    renderPipelineDetail();
    const modal = screen.getByTestId("pipeline-form-modal");

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Edit pipeline" }));

    // Assert
    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-edit-pipeline-id", "pipeline-123");
  });

  it("renders the executions section under the Executions heading", () => {
    // Act
    renderPipelineDetail();

    // Assert
    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Executions",
    });
    const section = heading.closest("section") as HTMLElement;

    expect(
      within(section).getByTestId("executions-section"),
    ).toBeInTheDocument();
  });
});
