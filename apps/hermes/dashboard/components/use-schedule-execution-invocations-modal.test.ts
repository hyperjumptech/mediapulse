import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fetchInvocationPayloadActionMock = vi.fn();

vi.mock("@/app/dashboard/executions/invocation-payload-actions", () => ({
  fetchInvocationPayloadAction: (...args: unknown[]) =>
    fetchInvocationPayloadActionMock(...args),
}));

import {
  useScheduleExecutionInvocationsModal,
  type InvocationPayload,
  type InvocationPayloadSource,
  type ScheduleExecutionInvocationRow,
} from "./use-schedule-execution-invocations-modal";

const payloadSource: InvocationPayloadSource = {
  kind: "schedule",
  parentId: "sched-1",
  executionId: "exec-1",
};

const sampleRow: ScheduleExecutionInvocationRow = {
  jobId: "550e8400-e29b-41d4-a716-446655440000",
  status: "failed",
  semanticStatus: null,
  outcomeSummary: "oops",
  agentId: "ticker-echo",
  startedAtIso: "2025-03-20T10:00:00.000Z",
  completedAtIso: "2025-03-20T10:00:01.000Z",
  dataQueueAttempts: null,
  dataQueueMaxAttempts: null,
};

const otherRow: ScheduleExecutionInvocationRow = {
  ...sampleRow,
  jobId: "job-other",
};

const samplePayload: InvocationPayload = {
  inputMasked: { a: 1 },
  configMasked: {},
  transportError: { message: "oops" },
  agentResponse: null,
};

const createDeferred = <Value>() => {
  let resolve: (value: Value) => void = () => undefined;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

describe("useScheduleExecutionInvocationsModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    fetchInvocationPayloadActionMock.mockReset();
  });

  it("fetches the selected job payload by its exact scope and clears it when closed", async () => {
    // Setup
    fetchInvocationPayloadActionMock.mockResolvedValue(samplePayload);
    const { result } = renderHook(() =>
      useScheduleExecutionInvocationsModal(payloadSource),
    );

    // Act
    await act(async () => {
      await result.current.openModal(sampleRow);
    });

    // Assert
    expect(fetchInvocationPayloadActionMock).toHaveBeenCalledWith({
      kind: "schedule",
      parentId: "sched-1",
      executionId: "exec-1",
      jobId: sampleRow.jobId,
    });
    expect(result.current.open).toBe(true);
    expect(result.current.selected).toEqual(sampleRow);
    expect(result.current.payload).toEqual(samplePayload);
    expect(result.current.loading).toBe(false);
    expect(result.current.errorMessage).toBeNull();

    // Act
    act(() => {
      result.current.onOpenChange(false);
    });

    // Assert
    expect(result.current.open).toBe(false);
    expect(result.current.selected).toBeNull();
    expect(result.current.payload).toBeNull();
  });

  it("reports loading while the payload request is pending", async () => {
    // Setup
    const deferred = createDeferred<InvocationPayload | null>();
    fetchInvocationPayloadActionMock.mockReturnValue(deferred.promise);
    const { result } = renderHook(() =>
      useScheduleExecutionInvocationsModal(payloadSource),
    );

    // Act
    let pendingOpen: Promise<void> = Promise.resolve();
    act(() => {
      pendingOpen = result.current.openModal(sampleRow);
    });

    // Assert
    expect(result.current.loading).toBe(true);
    expect(result.current.payload).toBeNull();

    // Act
    await act(async () => {
      deferred.resolve(samplePayload);
      await pendingOpen;
    });

    // Assert
    expect(result.current.loading).toBe(false);
    expect(result.current.payload).toEqual(samplePayload);
  });

  it("shows an error message when the payload request fails", async () => {
    // Setup
    fetchInvocationPayloadActionMock.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() =>
      useScheduleExecutionInvocationsModal(payloadSource),
    );

    // Act
    await act(async () => {
      await result.current.openModal(sampleRow);
    });

    // Assert
    expect(result.current.loading).toBe(false);
    expect(result.current.payload).toBeNull();
    expect(result.current.errorMessage).toMatch(/could not load/i);
  });

  it("shows an unavailable message when the job no longer exists", async () => {
    // Setup
    fetchInvocationPayloadActionMock.mockResolvedValue(null);
    const { result } = renderHook(() =>
      useScheduleExecutionInvocationsModal(payloadSource),
    );

    // Act
    await act(async () => {
      await result.current.openModal(sampleRow);
    });

    // Assert
    expect(result.current.payload).toBeNull();
    expect(result.current.errorMessage).toMatch(/no longer available/i);
  });

  it("ignores a stale response after a different row was opened", async () => {
    // Setup
    const firstRequest = createDeferred<InvocationPayload | null>();
    const secondPayload: InvocationPayload = {
      ...samplePayload,
      inputMasked: { second: true },
    };
    fetchInvocationPayloadActionMock
      .mockReturnValueOnce(firstRequest.promise)
      .mockResolvedValueOnce(secondPayload);
    const { result } = renderHook(() =>
      useScheduleExecutionInvocationsModal(payloadSource),
    );

    // Act
    let firstOpen: Promise<void> = Promise.resolve();
    act(() => {
      firstOpen = result.current.openModal(sampleRow);
    });
    await act(async () => {
      await result.current.openModal(otherRow);
    });
    await act(async () => {
      firstRequest.resolve(samplePayload);
      await firstOpen;
    });

    // Assert
    expect(result.current.selected).toEqual(otherRow);
    expect(result.current.payload).toEqual(secondPayload);
    expect(result.current.loading).toBe(false);
  });

  it("drops a response that arrives after the dialog was closed", async () => {
    // Setup
    const deferred = createDeferred<InvocationPayload | null>();
    fetchInvocationPayloadActionMock.mockReturnValue(deferred.promise);
    const { result } = renderHook(() =>
      useScheduleExecutionInvocationsModal(payloadSource),
    );

    // Act
    let pendingOpen: Promise<void> = Promise.resolve();
    act(() => {
      pendingOpen = result.current.openModal(sampleRow);
    });
    act(() => {
      result.current.onOpenChange(false);
    });
    await act(async () => {
      deferred.resolve(samplePayload);
      await pendingOpen;
    });

    // Assert
    expect(result.current.open).toBe(false);
    expect(result.current.payload).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
