import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCopyToClipboard } from "./use-copy-to-clipboard";

describe("useCopyToClipboard", () => {
  it("returns copied=false initially", () => {
    // Act
    const { result } = renderHook(() => useCopyToClipboard());

    // Assert
    expect(result.current.copied).toBe(false);
  });

  it("sets copied=true after successful copy", async () => {
    // Setup
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: { writeText: writeTextMock },
    });

    // Act
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => {
      await result.current.copy("test-text");
    });

    // Assert
    expect(writeTextMock).toHaveBeenCalledWith("test-text");
    expect(result.current.copied).toBe(true);
  });

  it("sets copied=false when copy fails", async () => {
    // Setup
    const writeTextMock = vi.fn().mockRejectedValue(new Error("no clipboard"));
    vi.stubGlobal("navigator", {
      clipboard: { writeText: writeTextMock },
    });

    // Act
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => {
      await result.current.copy("test-text");
    });

    // Assert
    expect(result.current.copied).toBe(false);
  });

  it("resets copied to false after timeout", async () => {
    // Setup
    vi.useFakeTimers();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: { writeText: writeTextMock },
    });

    // Act
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => {
      await result.current.copy("test-text");
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Assert
    expect(result.current.copied).toBe(false);
    vi.useRealTimers();
  });
});
