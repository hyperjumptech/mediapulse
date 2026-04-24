/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SECRET_MASK } from "@/lib/mask-json-secrets";

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
    if (result.current.status !== "invalid")
      throw new Error("expected invalid");
    expect(result.current.payloadPreview).toContain('"x"');
    expect(result.current.panelClass).toContain("destructive");
    const parsed = JSON.parse(result.current.copyJson) as {
      errors?: unknown;
      hermesEnqueueCorrelation?: unknown;
    };
    expect(parsed.errors).toEqual({ x: 1 });
    expect(parsed.hermesEnqueueCorrelation).toBeUndefined();
  });

  it("returns empty when errors array is empty", () => {
    const { result } = renderHook(() =>
      useEnqueueDiagnosticsPanelViewModel("failed", []),
    );
    expect(result.current).toMatchObject({ status: "empty" });
    expect(result.current).not.toHaveProperty("copyJson");
  });

  it("returns entries when diagnostics are present", () => {
    const { result } = renderHook(() =>
      useEnqueueDiagnosticsPanelViewModel("failed", [
        { message: "m", timestamp: "2026-01-01T00:00:00.000Z" },
      ]),
    );
    expect(result.current.status).toBe("entries");
    if (result.current.status !== "entries")
      throw new Error("expected entries");
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]?.message).toBe("m");
    const parsed = JSON.parse(result.current.copyJson) as {
      errors?: unknown[];
      hermesEnqueueCorrelation?: unknown;
    };
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors?.[0]).toMatchObject({ message: "m" });
    expect(parsed.hermesEnqueueCorrelation).toBeUndefined();
  });

  it("includes correlation from metadata on entries view", () => {
    const { result } = renderHook(() =>
      useEnqueueDiagnosticsPanelViewModel(
        "failed",
        [{ message: "m", timestamp: "2026-01-01T00:00:00.000Z" }],
        {
          hermesEnqueueCorrelation: { requestId: "r1", workerTickId: "7" },
        },
      ),
    );
    expect(result.current).toMatchObject({
      status: "entries",
      correlation: { requestId: "r1", workerTickId: "7" },
    });
    if (result.current.status !== "entries")
      throw new Error("expected entries");
    const parsed = JSON.parse(result.current.copyJson) as {
      errors?: unknown[];
      hermesEnqueueCorrelation?: { requestId?: string; workerTickId?: string };
    };
    expect(parsed.hermesEnqueueCorrelation).toEqual({
      requestId: "r1",
      workerTickId: "7",
    });
    expect(parsed.errors).toHaveLength(1);
  });

  it("includes correlation on invalid errors view", () => {
    const { result } = renderHook(() =>
      useEnqueueDiagnosticsPanelViewModel(
        "partial",
        { not: "array" },
        { hermesEnqueueCorrelation: { requestId: "corr-invalid" } },
      ),
    );
    expect(result.current.status).toBe("invalid");
    if (result.current.status !== "invalid")
      throw new Error("expected invalid");
    expect(result.current.correlation).toEqual({ requestId: "corr-invalid" });
    const parsed = JSON.parse(result.current.copyJson) as {
      errors?: unknown;
      hermesEnqueueCorrelation?: { requestId?: string };
    };
    expect(parsed.hermesEnqueueCorrelation).toEqual({
      requestId: "corr-invalid",
    });
    expect(parsed.errors).toEqual({ not: "array" });
  });

  it("masks secrets in copyJson for invalid errors", () => {
    const { result } = renderHook(() =>
      useEnqueueDiagnosticsPanelViewModel("failed", {
        nested: { apiKey: "secret-value" },
      }),
    );
    expect(result.current.status).toBe("invalid");
    if (result.current.status !== "invalid")
      throw new Error("expected invalid");
    expect(result.current.copyJson).toContain(SECRET_MASK);
    expect(result.current.copyJson).not.toContain("secret-value");
  });
});
