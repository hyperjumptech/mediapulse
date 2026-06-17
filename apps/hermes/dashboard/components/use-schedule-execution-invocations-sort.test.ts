import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScheduleExecutionInvocationRow } from "./use-schedule-execution-invocations-modal";
import {
  compareOptionalIsoDates,
  sortScheduleExecutionInvocationRows,
  useScheduleExecutionInvocationsSort,
} from "./use-schedule-execution-invocations-sort";

const baseRow = (
  jobId: string,
  startedAtIso: string | null,
  completedAtIso: string | null,
): ScheduleExecutionInvocationRow => ({
  jobId,
  status: "completed",
  semanticStatus: "success",
  outcomeSummary: null,
  transportError: null,
  agentResponse: null,
  inputMasked: {},
  configMasked: null,
  agentId: "agent-a",
  startedAtIso,
  completedAtIso,
  dataQueueAttempts: null,
  dataQueueMaxAttempts: null,
});

describe("compareOptionalIsoDates", () => {
  it("sorts missing dates after present dates", () => {
    // Act
    const asc = compareOptionalIsoDates(null, "2025-01-02T00:00:00.000Z", 1);

    // Assert
    expect(asc).toBeGreaterThan(0);
  });

  it("orders ISO strings chronologically when ascending", () => {
    // Act
    const cmp = compareOptionalIsoDates(
      "2025-01-01T00:00:00.000Z",
      "2025-01-02T00:00:00.000Z",
      1,
    );

    // Assert
    expect(cmp).toBeLessThan(0);
  });
});

describe("sortScheduleExecutionInvocationRows", () => {
  it("sorts by startedAt ascending", () => {
    // Setup
    const rows = [
      baseRow("b", "2025-01-02T00:00:00.000Z", null),
      baseRow("a", "2025-01-01T00:00:00.000Z", null),
    ];

    // Act
    const sorted = sortScheduleExecutionInvocationRows(
      rows,
      "startedAt",
      "asc",
    );

    // Assert
    expect(sorted.map((r) => r.jobId)).toEqual(["a", "b"]);
  });

  it("sorts by completedAt descending", () => {
    // Setup
    const rows = [
      baseRow("a", null, "2025-01-01T00:00:00.000Z"),
      baseRow("b", null, "2025-01-03T00:00:00.000Z"),
    ];

    // Act
    const sorted = sortScheduleExecutionInvocationRows(
      rows,
      "completedAt",
      "desc",
    );

    // Assert
    expect(sorted.map((r) => r.jobId)).toEqual(["b", "a"]);
  });
});

describe("useScheduleExecutionInvocationsSort", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to startedAt ascending", () => {
    // Setup
    const rows = [
      baseRow("b", "2025-01-02T00:00:00.000Z", null),
      baseRow("a", "2025-01-01T00:00:00.000Z", null),
    ];

    // Act
    const { result } = renderHook(() =>
      useScheduleExecutionInvocationsSort(rows),
    );

    // Assert
    expect(result.current.sortField).toBe("startedAt");
    expect(result.current.sortDir).toBe("asc");
    expect(result.current.sortedRows.map((r) => r.jobId)).toEqual(["a", "b"]);
  });

  it("toggles direction when the same field is activated again", () => {
    // Setup
    const rows = [baseRow("a", "2025-01-01T00:00:00.000Z", null)];

    // Act
    const { result } = renderHook(() =>
      useScheduleExecutionInvocationsSort(rows),
    );

    act(() => {
      result.current.toggleSort("startedAt");
    });

    // Assert
    expect(result.current.sortDir).toBe("desc");
  });

  it("switches field and resets to ascending", () => {
    // Setup
    const rows = [
      baseRow("a", "2025-01-02T00:00:00.000Z", "2025-01-01T00:00:00.000Z"),
    ];

    // Act
    const { result } = renderHook(() =>
      useScheduleExecutionInvocationsSort(rows),
    );

    act(() => {
      result.current.toggleSort("startedAt");
    });
    act(() => {
      result.current.toggleSort("completedAt");
    });

    // Assert
    expect(result.current.sortField).toBe("completedAt");
    expect(result.current.sortDir).toBe("asc");
  });
});
