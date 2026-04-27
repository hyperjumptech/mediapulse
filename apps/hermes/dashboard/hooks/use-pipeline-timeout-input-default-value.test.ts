/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePipelineTimeoutInputDefaultValue } from "./use-pipeline-timeout-input-default-value";

describe("usePipelineTimeoutInputDefaultValue", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an empty string when defaultTimeoutMs is omitted", () => {
    const { result } = renderHook(() =>
      usePipelineTimeoutInputDefaultValue(undefined),
    );

    expect(result.current).toBe("");
  });

  it("returns an empty string when defaultTimeoutMs is zero", () => {
    const { result } = renderHook(() => usePipelineTimeoutInputDefaultValue(0));

    expect(result.current).toBe("");
  });

  it("returns an empty string when defaultTimeoutMs is negative", () => {
    const { result } = renderHook(() =>
      usePipelineTimeoutInputDefaultValue(-1),
    );

    expect(result.current).toBe("");
  });

  it("returns a stringified positive timeout in milliseconds", () => {
    const { result } = renderHook(() =>
      usePipelineTimeoutInputDefaultValue(900000),
    );

    expect(result.current).toBe("900000");
  });
});
