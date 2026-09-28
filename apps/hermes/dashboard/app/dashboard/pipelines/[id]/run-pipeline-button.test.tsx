import React from "react";
import { render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  RunPipelineButton,
  RunPipelineResult,
  useRunPipeline,
  type RunPipelineAction,
} from "./run-pipeline-button";

vi.mock(
  "@/app/dashboard/pipelines/actions/run-pipeline/.generated/use-form-action",
  () => ({
    useFormAction: vi.fn(),
  }),
);

const MockFormWithAction = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <form data-testid="run-pipeline-form" className={className}>
    {children}
  </form>
);

type RunPipelineState = RunPipelineAction["state"];

const createRunPipelineAction = (overrides?: {
  state?: RunPipelineState;
  pending?: boolean;
}): RunPipelineAction =>
  ({
    FormWithAction: MockFormWithAction,
    state: overrides?.state ?? null,
    pending: overrides?.pending ?? false,
  }) as RunPipelineAction;

const createSuccessState = (
  data: Partial<{
    invocationsRun: number;
    executionId: string;
    runStatus: "running" | "succeeded" | "partial" | "failed" | "cancelled";
    failedInvocationCount: number;
  }>,
): RunPipelineState =>
  ({
    status: true,
    statusCode: 200,
    data: {
      ok: true,
      invocationsRun: 1,
      executionId: "00000000-0000-4000-8000-000000000001",
      runStatus: "succeeded",
      failedInvocationCount: 0,
      ...data,
    },
  }) as RunPipelineState;

const getUseFormActionMock = async () => {
  const generatedModule =
    await import("@/app/dashboard/pipelines/actions/run-pipeline/.generated/use-form-action");

  return generatedModule.useFormAction as Mock;
};

describe("RunPipelineButton", () => {
  it("submits the pipeline id through the run form", () => {
    // Act
    render(
      <RunPipelineButton
        pipelineId="pipeline-123"
        runPipelineAction={createRunPipelineAction()}
      />,
    );

    // Assert
    const form = screen.getByTestId("run-pipeline-form");
    const hiddenInput = form.querySelector('input[name="body.pipelineId"]');

    expect(hiddenInput).toHaveValue("pipeline-123");
    expect(screen.getByRole("button", { name: "Run pipeline" })).toBeEnabled();
  });

  it("shows a Running label and disables the button while pending", () => {
    // Act
    render(
      <RunPipelineButton
        pipelineId="pipeline-123"
        runPipelineAction={createRunPipelineAction({ pending: true })}
      />,
    );

    // Assert
    expect(screen.getByRole("button", { name: "Running…" })).toBeDisabled();
  });

  it("disables the button when the pipeline cannot run", () => {
    // Act
    render(
      <RunPipelineButton
        pipelineId="pipeline-123"
        disabled
        runPipelineAction={createRunPipelineAction()}
      />,
    );

    // Assert
    expect(screen.getByRole("button", { name: "Run pipeline" })).toBeDisabled();
  });
});

describe("RunPipelineResult", () => {
  it("renders nothing before the pipeline runs", () => {
    // Act
    const { container } = render(
      <RunPipelineResult pipelineId="pipeline-123" state={null} />,
    );

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the error message when the run fails", () => {
    // Setup
    const state = {
      status: false,
      statusCode: 400,
      message: "Pipeline is inactive",
    } as RunPipelineState;

    // Act
    render(<RunPipelineResult pipelineId="pipeline-123" state={state} />);

    // Assert
    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent("Couldn't run the pipeline");
    expect(alert).toHaveTextContent("Pipeline is inactive");
  });

  it("describes a finished run with its status and execution link", () => {
    // Setup
    const state = createSuccessState({
      invocationsRun: 5,
      runStatus: "succeeded",
      failedInvocationCount: 0,
      executionId: "00000000-0000-4000-8000-000000000005",
    });

    // Act
    render(<RunPipelineResult pipelineId="pipeline-123" state={state} />);

    // Assert
    expect(screen.getByText(/Ran 5 invocations/)).toBeInTheDocument();
    expect(screen.getByText(/Status succeeded, 0 failed/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open execution" }),
    ).toHaveAttribute(
      "href",
      "/dashboard/pipelines/pipeline-123/executions/00000000-0000-4000-8000-000000000005",
    );
  });

  it("uses the singular for a single invocation", () => {
    // Setup
    const state = createSuccessState({
      invocationsRun: 1,
      runStatus: "partial",
      failedInvocationCount: 1,
    });

    // Act
    render(<RunPipelineResult pipelineId="pipeline-123" state={state} />);

    // Assert
    expect(screen.getByText(/Ran 1 invocation\./)).toBeInTheDocument();
    expect(screen.getByText(/Status partial, 1 failed/)).toBeInTheDocument();
  });

  it("describes a queued run with a link to follow it live", () => {
    // Setup
    const state = createSuccessState({
      invocationsRun: 2,
      runStatus: "running",
      executionId: "00000000-0000-4000-8000-000000000002",
    });

    // Act
    render(<RunPipelineResult pipelineId="pipeline-123" state={state} />);

    // Assert
    expect(screen.getByText("Pipeline queued")).toBeInTheDocument();
    expect(
      screen.getByText(/Queued 2 invocations on the worker queue/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open execution" }),
    ).toHaveAttribute(
      "href",
      "/dashboard/pipelines/pipeline-123/executions/00000000-0000-4000-8000-000000000002",
    );
  });
});

describe("useRunPipeline", () => {
  afterEach(async () => {
    const useFormActionMock = await getUseFormActionMock();
    useFormActionMock.mockReset();
    vi.restoreAllMocks();
  });

  it("returns the generated run action", async () => {
    // Setup
    const useFormActionMock = await getUseFormActionMock();
    const runPipelineAction = createRunPipelineAction();
    useFormActionMock.mockReturnValue(runPipelineAction);

    // Act
    const { result } = renderHook(() => useRunPipeline());

    // Assert
    expect(result.current).toBe(runPipelineAction);
  });

  it("guards against leaving the page only while the run is pending", async () => {
    // Setup
    const useFormActionMock = await getUseFormActionMock();
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    useFormActionMock.mockReturnValue(
      createRunPipelineAction({ pending: true }),
    );

    // Act
    const { rerender } = renderHook(() => useRunPipeline());
    useFormActionMock.mockReturnValue(createRunPipelineAction());
    rerender();

    // Assert
    const beforeUnloadCalls = addEventListenerSpy.mock.calls.filter(
      ([eventName]) => eventName === "beforeunload",
    );
    const beforeUnloadHandler = beforeUnloadCalls[0]?.[1] as (
      event: BeforeUnloadEvent,
    ) => void;
    const unloadEvent = new Event("beforeunload", {
      cancelable: true,
    }) as BeforeUnloadEvent;
    beforeUnloadHandler(unloadEvent);

    expect(beforeUnloadCalls).toHaveLength(1);
    expect(unloadEvent.defaultPrevented).toBe(true);
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "beforeunload",
      beforeUnloadHandler,
    );
  });

  it("does not guard navigation when idle", async () => {
    // Setup
    const useFormActionMock = await getUseFormActionMock();
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    useFormActionMock.mockReturnValue(createRunPipelineAction());

    // Act
    renderHook(() => useRunPipeline());

    // Assert
    const beforeUnloadCalls = addEventListenerSpy.mock.calls.filter(
      ([eventName]) => eventName === "beforeunload",
    );

    expect(beforeUnloadCalls).toHaveLength(0);
  });
});
