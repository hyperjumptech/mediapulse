/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type CancelTarget,
  useHermesExecutionCancelButton,
} from "./use-hermes-execution-cancel-button";

const refreshMock = vi.fn();

const scheduleTarget: CancelTarget = {
  kind: "schedule",
  scheduleId: "00000000-0000-4000-8000-000000000001",
  scheduleExecutionId: "00000000-0000-4000-8000-000000000002",
};

describe("useHermesExecutionCancelButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    refreshMock.mockReset();
  });

  it("sets canCancel false when run is not pending or running", () => {
    const { result } = renderHook(() =>
      useHermesExecutionCancelButton(scheduleTarget, "succeeded", refreshMock),
    );
    expect(result.current.canCancel).toBe(false);
  });

  it("sets canCancel true for pending runs", () => {
    const { result } = renderHook(() =>
      useHermesExecutionCancelButton(scheduleTarget, "pending", refreshMock),
    );
    expect(result.current.canCancel).toBe(true);
  });

  it("POSTs to the schedule cancel route and refreshes on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useHermesExecutionCancelButton(scheduleTarget, "running", refreshMock),
    );

    await act(async () => {
      result.current.requestCancel();
    });

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/dashboard/schedules/actions/cancel-execution",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          scheduleId: scheduleTarget.scheduleId,
          scheduleExecutionId: scheduleTarget.scheduleExecutionId,
        }),
      }),
    );
  });

  it("alerts when the server returns an error body", async () => {
    const alertMock = vi.fn();
    vi.stubGlobal("alert", alertMock);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Execution is already finished" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useHermesExecutionCancelButton(scheduleTarget, "running", refreshMock),
    );

    await act(async () => {
      result.current.requestCancel();
    });

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith("Execution is already finished");
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
