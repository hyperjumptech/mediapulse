/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useDetailBlockTabs } from "./use-detail-block-tabs";

describe("useDetailBlockTabs", () => {
  it("starts on the first tab with no row-count selections", () => {
    const { result } = renderHook(() => useDetailBlockTabs());

    expect(result.current.activeIndex).toBe(0);
    expect(result.current.limitForTab(0)).toBeUndefined();
    expect(result.current.limitForTab(1)).toBeUndefined();
  });

  it("switches the active tab", () => {
    const { result } = renderHook(() => useDetailBlockTabs());

    act(() => result.current.setActiveIndex(2));

    expect(result.current.activeIndex).toBe(2);
  });

  it("records the row-count selection per tab independently", () => {
    const { result } = renderHook(() => useDetailBlockTabs());

    act(() => result.current.setLimitForTab(0, "10"));
    act(() => result.current.setLimitForTab(1, "all"));

    expect(result.current.limitForTab(0)).toBe("10");
    expect(result.current.limitForTab(1)).toBe("all");
  });

  it("overwrites an existing selection for the same tab", () => {
    const { result } = renderHook(() => useDetailBlockTabs());

    act(() => result.current.setLimitForTab(0, "5"));
    act(() => result.current.setLimitForTab(0, "25"));

    expect(result.current.limitForTab(0)).toBe("25");
  });
});
