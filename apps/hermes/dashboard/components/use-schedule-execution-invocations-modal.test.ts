import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  useScheduleExecutionInvocationsModal,
  type ScheduleExecutionInvocationRow,
} from "./use-schedule-execution-invocations-modal";

const sampleRow: ScheduleExecutionInvocationRow = {
  jobId: "550e8400-e29b-41d4-a716-446655440000",
  status: "failed",
  semanticStatus: null,
  errorSummary: "oops",
  inputMasked: { a: 1 },
  configMasked: {},
};

describe("useScheduleExecutionInvocationsModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens with the selected row and clears selection when closed", () => {
    // Act
    const { result } = renderHook(() => useScheduleExecutionInvocationsModal());

    act(() => {
      result.current.openModal(sampleRow);
    });

    // Assert
    expect(result.current.open).toBe(true);
    expect(result.current.selected).toEqual(sampleRow);

    // Act
    act(() => {
      result.current.onOpenChange(false);
    });

    // Assert
    expect(result.current.open).toBe(false);
    expect(result.current.selected).toBe(null);
  });
});
