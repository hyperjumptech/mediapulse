/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePaginatedItems } from "./use-paginated-items";

const items = Array.from({ length: 25 }, (_, index) => index + 1);

describe("usePaginatedItems", () => {
  it("returns the first page slice and the correct range label", () => {
    const { result } = renderHook(() => usePaginatedItems(items, 10));

    expect(result.current.visible).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.current.page).toBe(0);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.canGoBack).toBe(false);
    expect(result.current.canGoForward).toBe(true);
    expect(result.current.rangeLabel).toBe("1–10 of 25");
  });

  it("advances to the next page and re-slices", () => {
    // Setup
    const { result } = renderHook(() => usePaginatedItems(items, 10));

    // Act
    act(() => result.current.goForward());

    // Assert
    expect(result.current.page).toBe(1);
    expect(result.current.visible).toEqual([
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
    expect(result.current.rangeLabel).toBe("11–20 of 25");
    expect(result.current.canGoBack).toBe(true);
  });

  it("clamps the last page when items do not divide evenly", () => {
    // Setup
    const { result } = renderHook(() => usePaginatedItems(items, 10));

    // Act
    act(() => result.current.goForward());
    act(() => result.current.goForward());
    act(() => result.current.goForward());

    // Assert
    expect(result.current.page).toBe(2);
    expect(result.current.canGoForward).toBe(false);
    expect(result.current.visible).toEqual([21, 22, 23, 24, 25]);
    expect(result.current.rangeLabel).toBe("21–25 of 25");
  });

  it("returns an empty slice and a zero-of-zero label when the list is empty", () => {
    const { result } = renderHook(() => usePaginatedItems<number>([], 10));

    expect(result.current.visible).toEqual([]);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.canGoBack).toBe(false);
    expect(result.current.canGoForward).toBe(false);
    expect(result.current.rangeLabel).toBe("0 of 0");
  });

  it("treats a non-positive pageSize as 1", () => {
    const { result } = renderHook(() => usePaginatedItems(items, 0));

    expect(result.current.totalPages).toBe(25);
    expect(result.current.visible).toEqual([1]);
    expect(result.current.rangeLabel).toBe("1–1 of 25");
  });

  it("clamps goBack at zero and goForward at the last page", () => {
    // Setup
    const { result } = renderHook(() => usePaginatedItems(items, 10));

    // Act — already at page 0; goBack should not go negative.
    act(() => result.current.goBack());
    expect(result.current.page).toBe(0);

    // Act — advance past the end; goForward must clamp.
    act(() => result.current.goForward());
    act(() => result.current.goForward());
    act(() => result.current.goForward());
    act(() => result.current.goForward());

    // Assert
    expect(result.current.page).toBe(2);
    expect(result.current.canGoForward).toBe(false);
  });
});
