import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIsMobile } from "./use-mobile.js";

type ChangeListener = () => void;

const installMatchMedia = () => {
  const listeners = new Set<ChangeListener>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      addEventListener: (_event: string, listener: ChangeListener) =>
        listeners.add(listener),
      removeEventListener: (_event: string, listener: ChangeListener) =>
        listeners.delete(listener),
    })),
  );

  return listeners;
};

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
};

describe("useIsMobile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports mobile below 768px", () => {
    // Setup
    installMatchMedia();
    setViewportWidth(500);

    // Act
    const { result } = renderHook(() => useIsMobile());

    // Assert
    expect(result.current).toBe(true);
  });

  it("reports desktop at 768px and wider", () => {
    // Setup
    installMatchMedia();
    setViewportWidth(1024);

    // Act
    const { result } = renderHook(() => useIsMobile());

    // Assert
    expect(result.current).toBe(false);
  });

  it("updates when the viewport crosses the breakpoint and unsubscribes on unmount", () => {
    // Setup
    const listeners = installMatchMedia();
    setViewportWidth(1024);
    const { result, unmount } = renderHook(() => useIsMobile());

    // Act
    setViewportWidth(400);
    act(() => {
      listeners.forEach((listener) => listener());
    });

    // Assert
    expect(result.current).toBe(true);

    unmount();

    expect(listeners.size).toBe(0);
  });
});
