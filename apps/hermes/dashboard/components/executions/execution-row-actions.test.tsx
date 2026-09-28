import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ExecutionListRow } from "@/lib/execution-list";

import { ExecutionRowActions } from "./execution-row-actions";

const { requestCancel } = vi.hoisted(() => ({ requestCancel: vi.fn() }));

vi.mock("@/hooks/use-hermes-execution-cancel-button", async () => {
  const { isHermesExecutionCancellable } =
    await import("@/lib/hermes-execution-cancellable");

  return {
    useHermesExecutionCancelButton: (_target: unknown, runStatus: string) => ({
      isLoading: false,
      canCancel: isHermesExecutionCancellable(runStatus),
      requestCancel,
    }),
  };
});

const row: ExecutionListRow = {
  id: "exec-1",
  source: "http-trigger",
  sourceId: "trigger-1",
  sourceName: "Webhook",
  pipelineName: null,
  executionTime: new Date("2026-09-27T10:00:00Z"),
  runStatus: "running",
  enqueueStatus: "success",
  succeededInvocationCount: 0,
  failedInvocationCount: 0,
  elapsedLabel: null,
};

const openMenu = async () => {
  await act(async () => {
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Execution actions" }),
      { button: 0, ctrlKey: false },
    );
  });
};

describe("ExecutionRowActions", () => {
  it("opens the execution and cancels a run that is still going", async () => {
    render(<ExecutionRowActions row={row} />);

    await openMenu();

    expect(
      screen.getByRole("menuitem", { name: "Open execution" }),
    ).toHaveAttribute(
      "href",
      "/dashboard/http-triggers/trigger-1/executions/exec-1",
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "Cancel run" }));
    });

    expect(requestCancel).toHaveBeenCalledTimes(1);
  });

  it("only offers to open a finished run", async () => {
    render(<ExecutionRowActions row={{ ...row, runStatus: "succeeded" }} />);

    await openMenu();

    expect(
      screen.queryByRole("menuitem", { name: "Cancel run" }),
    ).not.toBeInTheDocument();
  });
});
