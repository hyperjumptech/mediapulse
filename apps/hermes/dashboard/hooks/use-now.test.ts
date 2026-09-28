import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNow } from "./use-now";

describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ticks on the refresh interval and stops on unmount", () => {
    // Setup
    const { result, unmount } = renderHook(() => useNow(1_000));

    // Act
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    // Assert
    expect(result.current.toISOString()).toBe("2026-09-28T12:00:01.000Z");

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
