/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  abortManualPipelineRunIfLocal,
  clearManualPipelineRunAbortController,
  registerManualPipelineRunAbortController,
  startManualExecutionCancelledPollFromDb,
} from "./manual-pipeline-run-abort";

describe("manual-pipeline-run-abort", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the same AbortSignal when registering twice for one execution id", () => {
    const id = "00000000-0000-4000-8000-0000000000a1";
    const a = registerManualPipelineRunAbortController(id);
    const b = registerManualPipelineRunAbortController(id);
    expect(a).toBe(b);
    clearManualPipelineRunAbortController(id);
  });

  it("fires abort on the registered signal", () => {
    const id = "00000000-0000-4000-8000-0000000000a2";
    const signal = registerManualPipelineRunAbortController(id);
    const listener = vi.fn();
    signal.addEventListener("abort", listener);
    abortManualPipelineRunIfLocal(id);
    expect(listener).toHaveBeenCalled();
    clearManualPipelineRunAbortController(id);
  });

  it("does nothing when abort is called after clear", () => {
    const id = "00000000-0000-4000-8000-0000000000a3";
    registerManualPipelineRunAbortController(id);
    clearManualPipelineRunAbortController(id);
    expect(() => abortManualPipelineRunIfLocal(id)).not.toThrow();
  });

  it("aborts the local signal on the first poll when cancelledAt is set", async () => {
    const id = "00000000-0000-4000-8000-0000000000b1";
    const signal = registerManualPipelineRunAbortController(id);
    const listener = vi.fn();
    signal.addEventListener("abort", listener);
    const findUnique = vi
      .fn()
      .mockResolvedValue({ cancelledAt: new Date("2026-01-01T00:00:00.000Z") });
    const stop = startManualExecutionCancelledPollFromDb(
      { manualPipelineExecution: { findUnique } },
      id,
      50,
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(listener).toHaveBeenCalled();
    expect(findUnique).toHaveBeenCalled();
    stop();
    clearManualPipelineRunAbortController(id);
  });
});
