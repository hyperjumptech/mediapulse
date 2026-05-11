import type React from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePipelineTimeoutPreview } from "./use-pipeline-timeout-preview";

describe("usePipelineTimeoutPreview", () => {
  it("initializes preview from defaultTimeoutMs", () => {
    const { result } = renderHook(() => usePipelineTimeoutPreview(300_000));
    expect(result.current.timeoutPreviewText).toContain("5 minutes");
  });

  it("updates preview on input", () => {
    const { result } = renderHook(() => usePipelineTimeoutPreview());
    act(() => {
      result.current.onTimeoutInput({
        currentTarget: { value: "60000" },
      } as unknown as React.FormEvent<HTMLInputElement>);
    });
    expect(result.current.timeoutPreviewText).toContain("1 minute");
  });

  it("resets when defaultTimeoutMs changes", () => {
    const { result, rerender } = renderHook(
      ({ ms }: { ms?: number }) => usePipelineTimeoutPreview(ms),
      { initialProps: { ms: undefined as number | undefined } },
    );
    expect(result.current.timeoutPreviewText).toContain("Hermes default");
    rerender({ ms: 120_000 });
    expect(result.current.timeoutPreviewText).toContain("2 minutes");
  });
});
