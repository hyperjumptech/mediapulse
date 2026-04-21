/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useEnqueueDiagnosticsPanelViewModel } from "./use-enqueue-diagnostics-panel";

describe("useEnqueueDiagnosticsPanelViewModel", () => {
  it("returns hidden when enqueue status is not failed or partial", () => {
    const { result } = renderHook(() =>
      useEnqueueDiagnosticsPanelViewModel("success", []),
    );
    expect(result.current).toEqual({ status: "hidden" });
  });

  it("returns invalid with masked JSON preview for non-array errors", () => {
    const { result } = renderHook(() =>
      useEnqueueDiagnosticsPanelViewModel("failed", { x: 1 }),
    );
    expect(result.current.status).toBe("invalid");
    if (result.current.status !== "invalid") throw new Error("expected invalid");
    expect(result.current.payloadPreview).toContain('"x"');
    expect(result.current.panelClass).toContain("destructive");
  });

  it("returns empty when errors array is empty", () => {
    const { result } = renderHook(() =>
      useEnqueueDiagnosticsPanelViewModel("failed", []),
    );
    expect(result.current).toMatchObject({ status: "empty" });
  });

  it("returns entries when diagnostics are present", () => {
    const { result } = renderHook(() =>
      useEnqueueDiagnosticsPanelViewModel("failed", [
        { message: "m", timestamp: "2026-01-01T00:00:00.000Z" },
      ]),
    );
    expect(result.current.status).toBe("entries");
    if (result.current.status !== "entries") throw new Error("expected entries");
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]?.message).toBe("m");
  });
});
